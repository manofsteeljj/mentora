import { useState, useRef, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Textarea } from './ui/textarea'
import {
  Send, Loader2, X, Trash2, MessageSquare, ShieldCheck, User,
} from 'lucide-react'

function csrf() {
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
}

function formatTimestamp(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString([], {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

/**
 * CommentsSidebar
 *
 * Review conversation for a lesson plan, shown next to the ONLYOFFICE editor.
 * The admin (reviewer) and the owning teacher can both read and add comments.
 *
 * Props:
 *   lessonPlanId   — lesson plan ID the comments belong to
 *   onClose        — callback when the user closes the sidebar
 *   onCountChange  — optional callback invoked with the current comment count
 */
export default function CommentsSidebar({ lessonPlanId, onClose, onCountChange }) {
  const [comments, setComments] = useState([])
  const [loading, setLoading]   = useState(true)
  const [posting, setPosting]   = useState(false)
  const [input, setInput]       = useState('')
  const scrollRef               = useRef(null)

  // Keep the count callback in a ref so a new inline function from the parent
  // never re-triggers the fetch effect below.
  const onCountChangeRef = useRef(onCountChange)
  useEffect(() => { onCountChangeRef.current = onCountChange })

  // ── Fetch comments ──────────────────────────────────────────────────────────
  const load = useCallback(() => {
    if (!lessonPlanId) return
    setLoading(true)
    fetch(`/api/lesson-plans/${lessonPlanId}/comments`, {
      headers: { Accept: 'application/json', 'X-CSRF-TOKEN': csrf() },
      credentials: 'same-origin',
    })
      .then(r => (r.ok ? r.json() : Promise.reject(r)))
      .then(data => {
        const list = Array.isArray(data?.comments) ? data.comments : []
        setComments(list)
        onCountChangeRef.current?.(list.length)
      })
      .catch(() => toast.error('Failed to load comments.'))
      .finally(() => setLoading(false))
  }, [lessonPlanId])

  useEffect(() => { load() }, [load])

  // ── Auto-scroll to the latest comment ───────────────────────────────────────
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [comments, posting])

  // ── Add a comment ───────────────────────────────────────────────────────────
  const submit = async (e) => {
    e.preventDefault()
    const body = input.trim()
    if (!body || posting) return

    setPosting(true)
    try {
      const res = await fetch(`/api/lesson-plans/${lessonPlanId}/comments`, {
        method:  'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrf() },
        credentials: 'same-origin',
        body: JSON.stringify({ body }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || 'Failed to add comment.')

      setComments(prev => [...prev, data.comment])
      onCountChangeRef.current?.(comments.length + 1)
      setInput('')
    } catch (err) {
      toast.error(err.message || 'Failed to add comment.')
    } finally {
      setPosting(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(e) }
  }

  // ── Delete a comment ────────────────────────────────────────────────────────
  const remove = async (comment) => {
    if (!confirm('Delete this comment?')) return
    try {
      const res = await fetch(`/api/lesson-plans/${lessonPlanId}/comments/${comment.id}`, {
        method: 'DELETE',
        headers: { Accept: 'application/json', 'X-CSRF-TOKEN': csrf() },
        credentials: 'same-origin',
      })
      if (!res.ok) throw new Error()
      setComments(prev => prev.filter(c => c.id !== comment.id))
      onCountChangeRef.current?.(comments.length - 1)
      toast.success('Comment deleted.')
    } catch {
      toast.error('Failed to delete comment.')
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <aside className="hidden md:flex flex-col flex-shrink-0 w-[360px] bg-white border-l border-gray-200 min-h-0">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
          <MessageSquare className="w-4 h-4 text-green-700" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm text-gray-900">Comments</h3>
            {comments.length > 0 && (
              <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-[10px] px-1.5">
                {comments.length}
              </Badge>
            )}
          </div>
          <p className="text-xs text-gray-500 truncate">
            Visible to the teacher and the admin reviewer
          </p>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={onClose} title="Close comments">
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* ── Comment list ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto bg-gray-50 p-4" ref={scrollRef}>
        {loading ? (
          <div className="flex items-center justify-center py-10 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />Loading…
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-10">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <MessageSquare className="w-7 h-7 text-green-600" />
            </div>
            <h3 className="font-medium text-sm text-gray-900">No comments yet</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-[240px] mx-auto">
              Feedback on this lesson plan will appear here — the teacher will see it on their side.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {comments.map(comment => (
              <div key={comment.id} className="flex gap-2.5">
                {/* Avatar */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  comment.user?.is_admin ? 'bg-amber-100' : 'bg-green-100'
                }`}>
                  {comment.user?.is_admin
                    ? <ShieldCheck className="w-4 h-4 text-amber-700" />
                    : <User className="w-4 h-4 text-green-700" />}
                </div>

                {/* Bubble */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-gray-900">
                      {comment.user?.name || 'Unknown'}
                    </span>
                    <Badge className={`text-[10px] px-1.5 ${
                      comment.user?.is_admin
                        ? 'bg-amber-100 text-amber-800 hover:bg-amber-100'
                        : 'bg-green-100 text-green-800 hover:bg-green-100'
                    }`}>
                      {comment.user?.is_admin ? 'Admin' : 'Teacher'}
                    </Badge>
                    <span className="text-xs text-gray-400">{formatTimestamp(comment.created_at)}</span>
                    {comment.can_delete && (
                      <button
                        type="button"
                        className="ml-auto text-gray-300 hover:text-red-500 transition-colors"
                        onClick={() => remove(comment)}
                        title="Delete comment"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-gray-700 mt-0.5 leading-relaxed">
                    {comment.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Input area ──────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-t border-gray-200 p-3 bg-white">
        <form onSubmit={submit}>
          <div className="flex gap-2 items-end">
            <Textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add a comment…"
              className="min-h-[52px] max-h-[160px] text-sm"
              disabled={posting}
            />
            <Button
              type="submit" size="icon"
              className="bg-green-700 hover:bg-green-800 h-[52px] w-[52px] flex-shrink-0"
              disabled={!input.trim() || posting}
            >
              {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-[11px] text-gray-400 mt-1.5">
            Enter to send · Shift+Enter for a new line
          </p>
        </form>
      </div>
    </aside>
  )
}
