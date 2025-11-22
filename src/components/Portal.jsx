import { useEffect, useRef, useState } from 'react'

const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

function useAntiCheat(active) {
  const [violations, setViolations] = useState(0)
  const isActiveRef = useRef(active)

  useEffect(() => { isActiveRef.current = active }, [active])

  useEffect(() => {
    if (!active) return

    const handleVisibility = () => {
      if (document.hidden && isActiveRef.current) {
        setViolations(v => v + 1)
        alert('Quiz paused due to tab switch. Please stay on this tab.')
      }
    }

    const handleBlur = () => {
      if (isActiveRef.current) {
        setViolations(v => v + 1)
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('blur', handleBlur)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('blur', handleBlur)
    }
  }, [active])

  return violations
}

export default function Portal() {
  const [user, setUser] = useState(null)
  const [modules, setModules] = useState([])
  const [days, setDays] = useState([])
  const [selectedDay, setSelectedDay] = useState(null)
  const [quiz, setQuiz] = useState(null)
  const [answers, setAnswers] = useState([])
  const [result, setResult] = useState(null)
  const [progress, setProgress] = useState([])
  const [loading, setLoading] = useState(false)

  const quizActive = !!quiz
  const violations = useAntiCheat(quizActive)

  const api = async (path, options = {}) => {
    const res = await fetch(`${API_URL}${path}`, { headers: { 'Content-Type': 'application/json' }, ...options })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  }

  useEffect(() => {
    // Auto-create a demo user for now
    (async () => {
      const u = await api('/users', { method: 'POST', body: JSON.stringify({ name: 'Demo User', email: 'demo@aptlearn.io' }) })
      setUser(u)
      const m = await api('/modules')
      setModules(m)
      const d = await api('/days')
      setDays(d)
      const p = await api(`/progress/${u.id}`)
      setProgress(p.completed_days || [])
    })()
  }, [])

  const openDay = async (d) => {
    setSelectedDay(d)
    setResult(null)
    setQuiz(null)
    setAnswers([])
    const q = await api(`/quiz/${d.day_number}`)
    setQuiz(q)
    setAnswers(new Array(q.questions.length).fill(-1))
  }

  const submit = async () => {
    if (!user || !selectedDay) return
    setLoading(true)
    try {
      const payload = { user_id: user.id, day_number: selectedDay.day_number, answers, violations }
      const r = await api('/attempt', { method: 'POST', body: JSON.stringify(payload) })
      setResult(r)
      setQuiz(null)
      const p = await api(`/progress/${user.id}`)
      setProgress(p.completed_days || [])
    } catch (e) {
      alert('Submission failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100">
      <header className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
        <h1 className="text-xl font-semibold">AptLearn – 15-Day Interview Prep</h1>
        <div className="text-sm opacity-80">{user ? `Signed in as ${user.name}` : 'Loading...'}</div>
      </header>

      <main className="max-w-6xl mx-auto p-6 grid md:grid-cols-3 gap-6">
        <aside className="md:col-span-1 space-y-4">
          <div className="bg-white/5 rounded-xl p-4">
            <h2 className="font-semibold mb-3">Modules</h2>
            <div className="space-y-2">
              {modules.map(m => (
                <div key={m.key} className="px-3 py-2 rounded bg-white/5 border border-white/10">
                  <div className="font-medium">{m.title}</div>
                  <div className="text-xs opacity-70 capitalize">{m.key}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white/5 rounded-xl p-4">
            <h2 className="font-semibold mb-3">Your Progress</h2>
            <div className="text-sm">Completed days: {progress.length} / 15</div>
            <div className="mt-2 grid grid-cols-5 gap-2">
              {Array.from({ length: 15 }, (_, i) => i + 1).map(n => (
                <div key={n} className={`h-7 rounded flex items-center justify-center text-xs ${progress.includes(n) ? 'bg-emerald-500/80' : 'bg-white/10'}`}>{n}</div>
              ))}
            </div>
          </div>
        </aside>

        <section className="md:col-span-2 space-y-4">
          {!selectedDay && (
            <div className="bg-white/5 rounded-xl p-6 border border-white/10">
              <h2 className="text-lg font-semibold mb-2">Select a day to start</h2>
              <p className="opacity-80 mb-4">Each day includes a video, notes, and a short quiz secured with anti-cheating checks.</p>
              <div className="grid sm:grid-cols-2 gap-3">
                {days.map(d => (
                  <button key={d.day_number} onClick={() => openDay(d)} className="p-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-left">
                    <div className="text-sm opacity-70">Day {d.day_number} • {d.module_key.toUpperCase()}</div>
                    <div className="font-medium">{d.title}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedDay && !quiz && !result && (
            <div className="bg-white/5 rounded-xl p-6 border border-white/10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Day {selectedDay.day_number}: {selectedDay.title}</h2>
                <button onClick={() => setSelectedDay(null)} className="text-sm opacity-80 hover:opacity-100">Back</button>
              </div>
              <div className="aspect-video bg-black/40 rounded-lg overflow-hidden border border-white/10 mb-4">
                <iframe title="video" src={selectedDay.video_url} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>
              </div>
              <div className="prose prose-invert max-w-none text-sm opacity-90">
                {selectedDay.notes}
              </div>
              <button onClick={() => openDay(selectedDay)} className="mt-4 px-4 py-2 rounded bg-blue-500 hover:bg-blue-600">Start Quiz</button>
            </div>
          )}

          {quiz && (
            <div className="bg-white/5 rounded-xl p-6 border border-white/10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Quiz • Day {quiz.day_number}</h2>
                <div className="text-sm opacity-80">Violations detected: {violations}</div>
              </div>
              <div className="space-y-4">
                {quiz.questions.map((q, idx) => (
                  <div key={idx} className="p-3 rounded bg-white/5 border border-white/10">
                    <div className="font-medium mb-2">{idx + 1}. {q.prompt}</div>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {q.options.map((opt, i) => (
                        <label key={i} className={`px-3 py-2 rounded border cursor-pointer ${answers[idx] === i ? 'bg-blue-500/30 border-blue-400' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
                          <input type="radio" name={`q-${idx}`} className="hidden" onChange={() => setAnswers(a => { const b = [...a]; b[idx] = i; return b })} />
                          {String.fromCharCode(65 + i)}. {opt}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <button disabled={loading} onClick={submit} className="mt-4 px-4 py-2 rounded bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60">{loading ? 'Submitting...' : 'Submit Quiz'}</button>
            </div>
          )}

          {result && (
            <div className="bg-white/5 rounded-xl p-6 border border-white/10">
              <h2 className="text-lg font-semibold mb-2">Result</h2>
              <div className="opacity-90">Score: {result.score} / {result.total} • {result.passed ? 'Passed' : 'Not passed'} {result.flagged ? '(flagged)' : ''}</div>
              <button onClick={() => setSelectedDay(null)} className="mt-4 px-4 py-2 rounded bg-blue-500 hover:bg-blue-600">Back to Days</button>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
