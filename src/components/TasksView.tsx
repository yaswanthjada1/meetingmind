import React, { useState, useEffect } from 'react';
import { db } from '../db';
import { TaskItem } from '../types';
import {
  CheckCircle2,
  Circle,
  Clock,
  Plus,
  Filter,
  User,
  ExternalLink,
  Calendar,
} from 'lucide-react';

interface TasksViewProps {
  userId?: string;
  onSelectMeeting: (meetingId: string) => void;
}

export const TasksView: React.FC<TasksViewProps> = ({ userId = '', onSelectMeeting }) => {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [filterAssignee, setFilterAssignee] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'done'>('all');
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newAssignee, setNewAssignee] = useState('');
  const todayStr = new Date().toISOString().split('T')[0];
  const [newDeadline, setNewDeadline] = useState(todayStr);

  const loadTasks = async () => {
    if (!userId) { setTasks([]); return; }
    const list = await db.tasks.where('userId').equals(userId).toArray();
    setTasks(list);
  };

  useEffect(() => {
    loadTasks();
  }, [userId]);

  const handleToggleTask = async (task: TaskItem) => {
    const nextStatus = task.status === 'done' ? 'todo' : 'done';
    task.status = nextStatus;
    await db.tasks.put(task);
    loadTasks();
  };

  const handleCreateTask = async () => {
    if (!newTitle.trim()) return;
    const task: TaskItem = {
      id: `task-${Date.now()}`,
      userId,
      title: newTitle.trim(),
      assignee: newAssignee,
      deadline: newDeadline,
      status: 'todo',
      priority: 'high',
      createdAt: Date.now(),
    };
    await db.tasks.put(task);
    setIsCreating(false);
    setNewTitle('');
    loadTasks();
  };

  const filteredTasks = tasks.filter((t) => {
    if (filterAssignee !== 'all' && t.assignee.toLowerCase() !== filterAssignee.toLowerCase()) {
      return false;
    }
    if (filterStatus === 'pending' && t.status === 'done') return false;
    if (filterStatus === 'done' && t.status !== 'done') return false;
    return true;
  });

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 animate-in fade-in duration-150 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-zinc-200">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">
            Tasks & Commitments
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            Indexed locally • Derived from meeting discussions
          </p>
        </div>

        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-800 rounded-md transition-colors shadow-2xs self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Task</span>
        </button>
      </div>

      {/* New Task Inline Modal */}
      {isCreating && (
        <div className="bg-white rounded-lg p-4 mb-6 border border-zinc-300 animate-in slide-in-from-top-2 duration-150">
          <h4 className="text-xs font-semibold text-zinc-900 mb-3">Create New Task Item</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <div className="sm:col-span-1">
              <label className="block text-[11px] font-mono uppercase text-zinc-400 mb-1">Task</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Audit rate limit headers"
                className="w-full text-xs px-3 py-1.5 rounded-md border border-zinc-200"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono uppercase text-zinc-400 mb-1">Assignee</label>
              <input
                type="text"
                value={newAssignee}
                onChange={(e) => setNewAssignee(e.target.value)}
                placeholder="Rahul"
                className="w-full text-xs px-3 py-1.5 rounded-md border border-zinc-200"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono uppercase text-zinc-400 mb-1">Deadline</label>
              <input
                type="date"
                value={newDeadline}
                onChange={(e) => setNewDeadline(e.target.value)}
                className="w-full text-xs px-3 py-1.5 rounded-md border border-zinc-200 font-mono"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setIsCreating(false)}
              className="px-3 py-1 text-xs text-zinc-600 hover:text-zinc-900"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateTask}
              className="px-3.5 py-1 text-xs font-medium bg-zinc-900 text-white rounded-md"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-zinc-400 font-mono text-[11px]">Filter:</span>
          {(['all', 'pending', 'done'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-2.5 py-1 rounded-md capitalize font-medium transition-colors ${
                filterStatus === st
                  ? 'bg-zinc-900 text-white'
                  : 'text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-zinc-400 font-mono text-[11px]">Assignee:</span>
          <select
            value={filterAssignee}
            onChange={(e) => setFilterAssignee(e.target.value)}
            className="text-xs px-2.5 py-1 rounded-md border border-zinc-200 bg-white"
          >
            <option value="all">All People</option>
            <option value="Rahul">Rahul</option>
            <option value="Priya">Priya</option>
            <option value="Alex">Alex</option>
            <option value="Yaswanth">Yaswanth</option>
          </select>
        </div>
      </div>

      {/* Tasks List */}
      <div className="space-y-2">
        {filteredTasks.length === 0 ? (
          <div className="border border-dashed border-zinc-200 rounded-lg p-8 text-center text-xs text-zinc-400 font-mono">
            No tasks found.
          </div>
        ) : (
          filteredTasks.map((task) => {
            const isDone = task.status === 'done';
            const isOverdue = task.deadline && new Date(task.deadline) < new Date('2026-09-26') && !isDone;

            return (
              <div
                key={task.id}
                className={`bg-white border rounded-lg p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                  isOverdue ? 'border-black bg-zinc-50' : 'border-zinc-200 hover:border-zinc-300'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <button
                    onClick={() => handleToggleTask(task)}
                    className="mt-0.5 text-zinc-400 hover:text-zinc-900"
                  >
                    {isDone ? (
                      <CheckCircle2 className="w-4 h-4 text-black" />
                    ) : (
                      <Circle className="w-4 h-4 text-zinc-300 hover:text-zinc-500" />
                    )}
                  </button>

                  <div>
                    <span
                      className={`text-xs font-medium ${
                        isDone ? 'line-through text-zinc-400' : 'text-zinc-900'
                      }`}
                    >
                      {task.title}
                    </span>
                    {task.notes && (
                      <p className="text-[11px] text-zinc-400 mt-0.5">{task.notes}</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 self-end sm:self-auto text-xs font-mono">
                  {/* Assignee */}
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-100 text-zinc-600 text-[11px]">
                    <User className="w-3 h-3 text-zinc-400" />
                    {task.assignee}
                  </span>

                  {/* Deadline */}
                  {task.deadline && (
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] ${
                        isOverdue
                          ? 'bg-black text-white font-bold'
                          : 'bg-zinc-100 text-zinc-500'
                      }`}
                    >
                      <Calendar className="w-3 h-3 text-zinc-400" />
                      {task.deadline} {isOverdue && '(OVERDUE)'}
                    </span>
                  )}

                  {/* Source */}
                  {task.sourceMeetingId && (
                    <button
                      onClick={() => onSelectMeeting(task.sourceMeetingId!)}
                      className="text-zinc-500 hover:text-zinc-900 flex items-center gap-1 font-sans text-[11px]"
                    >
                      Source <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
