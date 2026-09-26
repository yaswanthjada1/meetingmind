import { db } from '../db';
import { CalendarEvent } from '../types';

export interface SlotAvailability {
  start: string; // ISO or "2026-09-27T16:00:00"
  end: string;
  timeLabel: string; // e.g. "4:00 PM - 4:30 PM"
  isAvailable: boolean;
  conflictingParticipants: string[];
  conflictDetails: string[];
}

export interface SchedulingRecommendation {
  requestedSlot: SlotAvailability;
  isRequestedAvailable: boolean;
  recommendedSlot?: SlotAvailability;
  availableSlots: SlotAvailability[];
  evidence: {
    inputs: {
      requestedTime: string;
      date: string;
      durationMinutes: number;
      participants: string[];
    };
    constraints: string[];
    selectedAction: string;
    rationale: string;
  };
}

function parseTimeToDate(dateStr: string, timeStr: string): Date {
  // Supports "16:00", "4:00 PM", "4:00", "16:00:00"
  const cleanDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
  
  let hours = 0;
  let minutes = 0;

  const match12 = timeStr.match(/(\d+)(?::(\d+))?\s*(am|pm)?/i);
  if (match12) {
    hours = parseInt(match12[1], 10);
    minutes = match12[2] ? parseInt(match12[2], 10) : 0;
    const meridian = match12[3]?.toLowerCase();

    if (meridian === 'pm' && hours < 12) hours += 12;
    if (meridian === 'am' && hours === 12) hours = 0;
    // If standard 24-hour e.g. 16:00
    if (!meridian && hours < 8) {
      // If user typed 4, likely 4 PM (16:00) during work hours
      if (hours <= 6) hours += 12;
    }
  }

  const d = new Date(`${cleanDate}T00:00:00`);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

export async function checkSlotAvailability(
  participants: string[],
  date: string,
  startTimeStr: string,
  durationMinutes = 30
): Promise<SchedulingRecommendation> {
  const allEvents = await db.calendarEvents.toArray();

  const startDate = parseTimeToDate(date, startTimeStr);
  const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);

  const startIso = startDate.toISOString();
  const endIso = endDate.toISOString();

  const reqStartMs = startDate.getTime();
  const reqEndMs = endDate.getTime();

  // Check conflicts for requested slot
  const conflictingParticipants: string[] = [];
  const conflictDetails: string[] = [];

  for (const ev of allEvents) {
    if (ev.status === 'cancelled') continue;

    // Check if any participant matches
    const hasParticipant = participants.some((p) =>
      ev.participants.some((ep) => ep.toLowerCase().includes(p.toLowerCase()) || p.toLowerCase().includes(ep.toLowerCase()))
    );

    if (hasParticipant) {
      const evStartMs = new Date(ev.start).getTime();
      const evEndMs = new Date(ev.end).getTime();

      // Check overlap: start < evEnd && end > evStart
      if (reqStartMs < evEndMs && reqEndMs > evStartMs) {
        for (const p of participants) {
          if (ev.participants.some((ep) => ep.toLowerCase().includes(p.toLowerCase()))) {
            if (!conflictingParticipants.includes(p)) {
              conflictingParticipants.push(p);
            }
          }
        }
        conflictDetails.push(`${ev.title} (${new Date(ev.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(ev.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`);
      }
    }
  }

  const isRequestedAvailable = conflictingParticipants.length === 0;

  const requestedSlot: SlotAvailability = {
    start: startIso,
    end: endIso,
    timeLabel: `${startDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} – ${endDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`,
    isAvailable: isRequestedAvailable,
    conflictingParticipants,
    conflictDetails,
  };

  // Find candidate slots throughout the day (9 AM to 6 PM)
  const candidateTimes = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
  const availableSlots: SlotAvailability[] = [];

  for (const time of candidateTimes) {
    const sDate = parseTimeToDate(date, time);
    const eDate = new Date(sDate.getTime() + durationMinutes * 60 * 1000);
    const sMs = sDate.getTime();
    const eMs = eDate.getTime();

    let slotHasConflict = false;
    const slotConflicts: string[] = [];
    const slotConfDetails: string[] = [];

    for (const ev of allEvents) {
      if (ev.status === 'cancelled') continue;
      const hasP = participants.some((p) =>
        ev.participants.some((ep) => ep.toLowerCase().includes(p.toLowerCase()) || p.toLowerCase().includes(ep.toLowerCase()))
      );

      if (hasP) {
        const evStartMs = new Date(ev.start).getTime();
        const evEndMs = new Date(ev.end).getTime();
        if (sMs < evEndMs && eMs > evStartMs) {
          slotHasConflict = true;
          slotConfDetails.push(ev.title);
          for (const p of participants) {
            if (ev.participants.some((ep) => ep.toLowerCase().includes(p.toLowerCase()))) {
              if (!slotConflicts.includes(p)) slotConflicts.push(p);
            }
          }
        }
      }
    }

    const slot: SlotAvailability = {
      start: sDate.toISOString(),
      end: eDate.toISOString(),
      timeLabel: `${sDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} – ${eDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`,
      isAvailable: !slotHasConflict,
      conflictingParticipants: slotConflicts,
      conflictDetails: slotConfDetails,
    };

    if (!slotHasConflict) {
      availableSlots.push(slot);
    }
  }

  // Find nearest recommended slot
  let recommendedSlot: SlotAvailability | undefined = isRequestedAvailable ? requestedSlot : undefined;
  if (!isRequestedAvailable && availableSlots.length > 0) {
    // Pick the slot closest to the requested time, e.g. 5:00 PM if 4:00 PM was requested
    recommendedSlot = availableSlots.find((s) => {
      const h = new Date(s.start).getHours();
      return h >= startDate.getHours();
    }) || availableSlots[0];
  }

  // Construct structured "Why?" evidence
  const constraints: string[] = [];
  if (!isRequestedAvailable) {
    constraints.push(`Requested slot (${requestedSlot.timeLabel}) has a scheduling conflict: ${conflictingParticipants.join(', ')} is busy.`);
    if (conflictDetails.length > 0) {
      constraints.push(`Existing event: ${conflictDetails.join(', ')}.`);
    }
  } else {
    constraints.push(`All participants (${participants.join(', ')}) have no overlapping calendar commitments.`);
  }

  const rationale = isRequestedAvailable
    ? `The requested time (${requestedSlot.timeLabel}) is completely clear for ${participants.join(', ')}.`
    : `${conflictingParticipants.join(', ')} is unavailable at ${requestedSlot.timeLabel}. The next earliest mutual opening is ${recommendedSlot?.timeLabel}.`;

  return {
    requestedSlot,
    isRequestedAvailable,
    recommendedSlot,
    availableSlots,
    evidence: {
      inputs: {
        requestedTime: startTimeStr,
        date,
        durationMinutes,
        participants,
      },
      constraints,
      selectedAction: isRequestedAvailable ? `Schedule for ${requestedSlot.timeLabel}` : `Recommend ${recommendedSlot?.timeLabel || 'alternative'}`,
      rationale,
    },
  };
}

export async function createCalendarEvent(
  title: string,
  participants: string[],
  start: string,
  end: string,
  userId = '',
  location = 'Virtual Meeting Room'
): Promise<CalendarEvent> {
  const event: CalendarEvent = {
    id: `cal-${Date.now()}`,
    userId,
    title,
    participants,
    start,
    end,
    location,
    status: 'confirmed',
  };

  await db.calendarEvents.put(event);
  return event;
}
