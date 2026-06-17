import { useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import {
  Upload, FileSpreadsheet, CheckCircle2, Users, BookOpen,
  ChevronDown, ChevronUp, ArrowLeft, AlertTriangle, School,
  GraduationCap, Pencil,
} from 'lucide-react'
import { toast } from 'sonner'
import { Input } from './ui/input'
import { Label } from './ui/label'

function getToken() {
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
}

// ─── DepEd Transmutation Table ────────────────────────────────────────────────
function transmute(g) {
  g = Number(g)
  if (isNaN(g)) return null
  if (g >= 100) return 100
  if (g < 0) return 60
  const table = [
    [98.40,100],[96.80,99],[95.20,98],[93.60,97],[92.00,96],
    [90.40,95], [88.80,94],[87.20,93],[85.60,92],[84.00,91],
    [82.40,90], [80.80,89],[79.20,88],[77.60,87],[76.00,86],
    [74.40,85], [72.80,84],[71.20,83],[69.60,82],[68.00,81],
    [66.40,80], [64.80,79],[63.20,78],[61.60,77],[60.00,76],
    [56.00,75], [52.00,74],[48.00,73],[44.00,72],[40.00,71],
    [36.00,70], [32.00,69],[28.00,68],[24.00,67],[20.00,66],
    [16.00,65], [12.00,64],[8.00,63], [4.00,62], [0,61],
  ]
  for (let i = 0; i < table.length - 1; i++) {
    if (g >= table[i][0]) return table[i][1]
  }
  return 61
}

// gago ang pangit

// ─── Subject weights ──────────────────────────────────────────────────────────
const SUBJECT_WEIGHTS = {
  FILIPINO:    { ww:0.30, pt:0.50, qa:0.20 },
  ENGLISH:     { ww:0.30, pt:0.50, qa:0.20 },
  MATHEMATICS: { ww:0.40, pt:0.40, qa:0.20 },
  MATH:        { ww:0.40, pt:0.40, qa:0.20 },
  SCIENCE:     { ww:0.40, pt:0.40, qa:0.20 },
  'ARALING PANLIPUNAN': { ww:0.30, pt:0.50, qa:0.20 },
  AP:          { ww:0.30, pt:0.50, qa:0.20 },
  'EDUKASYON SA PAGPAPAKATAO': { ww:0.30, pt:0.50, qa:0.20 },
  ESP:         { ww:0.30, pt:0.50, qa:0.20 },
  TLE:         { ww:0.20, pt:0.60, qa:0.20 },
  'EDUKASYONG PANTAHANAN AT PANGKABUHAYAN': { ww:0.20, pt:0.60, qa:0.20 },
  'MOTHER TONGUE': { ww:0.30, pt:0.50, qa:0.20 },
  MT:          { ww:0.30, pt:0.50, qa:0.20 },
}

function getWeights(subject) {
  const upper = subject.toUpperCase()
  const key = Object.keys(SUBJECT_WEIGHTS).find(k => upper.includes(k))
  return key ? SUBJECT_WEIGHTS[key] : { ww:0.30, pt:0.50, qa:0.20 }
}

// ass hard coded 

// ─── Subject → short code ─────────────────────────────────────────────────────
function subjectCode(subject) {
  const upper = subject.toUpperCase()
  if (upper.includes('FILIPINO'))     return 'FIL'
  if (upper.includes('ENGLISH'))      return 'ENG'
  if (upper.includes('MATH'))         return 'MATH'
  if (upper.includes('SCIENCE'))      return 'SCI'
  if (upper.includes('ARALING'))      return 'AP'
  if (upper.includes('EDUKASYON SA')) return 'ESP'
  if (upper.includes('PANTAHANAN'))   return 'TLE'
  if (upper.includes('MOTHER'))       return 'MT'
  if (upper.includes('TLE'))          return 'TLE'
  return subject.slice(0, 6).toUpperCase()
}

// ─── Column map detector ──────────────────────────────────────────────────────
function findColumnMap(raw) {
  let hpsRow = -1
  for (let i = 0; i < raw.length; i++) {
    const joined = raw[i].map(c => String(c || '')).join('|').toUpperCase()
    if (joined.includes('HIGHEST POSSIBLE SCORE') || joined.includes('HIGHEST POSSIBLE')) {
      hpsRow = i; break
    }
  }
  if (hpsRow === -1) return null

  let colLabelRow = -1
  for (let i = Math.max(0, hpsRow - 4); i < hpsRow; i++) {
    const vals = raw[i].map(c => String(c || '').trim().toUpperCase())
    if (vals.filter(v => v === 'PS').length >= 2 && vals.filter(v => v === 'WS').length >= 2) {
      colLabelRow = i; break
    }
  }
  if (colLabelRow === -1) return null

  const labels = raw[colLabelRow].map(c => String(c || '').trim().toUpperCase())
  const psIndices = labels.reduce((a, l, i) => { if (l === 'PS') a.push(i); return a }, [])
  const wsIndices = labels.reduce((a, l, i) => { if (l === 'WS') a.push(i); return a }, [])

  if (psIndices.length < 2) return null

  // Individual item cols sit between group-start and their PS column
  // WW items: from first data col after col 1 (name) up to psIndices[0]-2 (before Total col)
  // PT items: from psIndices[0]+2 (after WW WS col) up to psIndices[1]-2
  // QA items: from psIndices[1]+2 up to psIndices[last]-2

  // Detect group boundaries using HPS row — non-empty numeric cells before Total
  const hps = raw[hpsRow]

  const getItemCols = (startCol, psCol) => {
    // Total col is psCol - 1, items are startCol..psCol-2
    const cols = []
    for (let c = startCol; c <= psCol - 2; c++) {
      const v = hps[c]
      const n = Number(v)
      if (v !== '' && v !== null && v !== undefined && !isNaN(n) && n > 0) {
        cols.push({ col: c, maxScore: n })
      }
    }
    return cols
  }

  // WW starts right after the name col (col 2 typically, but scan from col 2)
  const wwStartCol = 2
  const wwItemCols = getItemCols(wwStartCol, psIndices[0])

  // PT starts after WW WS col
  const wwWsCol = wsIndices[0] ?? psIndices[0] + 1
  const ptStartCol = wwWsCol + 1
  const ptItemCols = getItemCols(ptStartCol, psIndices[1])

  // QA starts after PT WS col
  const ptWsCol = wsIndices.length > 1 ? wsIndices[1] : psIndices[1] + 1
  const qaStartCol = ptWsCol + 1
  const qaPsCol = psIndices[psIndices.length - 1]
  const qaItemCols = getItemCols(qaStartCol, qaPsCol)

  const lastWsCol       = wsIndices[wsIndices.length - 1] ?? -1
  const initialGradeCol = lastWsCol >= 0 ? lastWsCol + 1 : -1

  return {
    wwItemCols,   // [{col, maxScore}, ...]
    ptItemCols,
    qaItemCols,
    // legacy PS cols kept for fallback
    wwPsCol:        psIndices[0],
    ptPsCol:        psIndices[1],
    qaPsCol,
    initialGradeCol,
    hpsRow,
  }
}

// ─── Excel parser ─────────────────────────────────────────────────────────────
async function parseDepEdExcel(file) {
  const XLSX = await import('xlsx')
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })

  // ── Global metadata from ANY sheet ────────────────────────────────────────
  let schoolName  = ''
  let schoolId    = ''
  let schoolYear  = ''
  let teacherName = ''
  let gradeSection = ''
  let district    = ''
  let division    = ''

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName]
    if (!ws) continue
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true })
    for (let i = 0; i < Math.min(15, raw.length); i++) {
      const rowStr = raw[i].map(c => String(c || '')).join(' ')
      const rowUp  = rowStr.toUpperCase()

      if (!schoolName) {
        const m = rowStr.match(/SCHOOL\s+NAME[:\s]+(.+?)(?:\t|SCHOOL ID|$)/i)
        if (m) schoolName = m[1].trim()
      }
      if (!schoolId) {
        const m = rowStr.match(/SCHOOL\s+ID[:\s]+(\d+)/i)
        if (m) schoolId = m[1].trim()
      }
      if (!schoolYear) {
        const m = rowStr.match(/SCHOOL\s+YEAR[:\s]+([\d\s\-–]+)/i)
        if (m) schoolYear = m[1].trim().replace(/\s+/g, ' ')
      }
      if (!teacherName) {
        const m = rowStr.match(/TEACHER[:\s]+(.+?)(?:\t|$)/i)
        if (m && m[1].trim().length > 2) teacherName = m[1].trim()
      }
      if (!gradeSection) {
        const m = rowStr.match(/GRADE\s*[&\-]?\s*SECTION[:\s]+(.+?)(?:\t|$)/i)
        if (m && m[1].trim().length > 1) gradeSection = m[1].trim()
      }
      if (!district) {
        const m = rowStr.match(/DISTRICT[:\s]+(.+?)(?:\t|$)/i)
        if (m) district = m[1].trim()
      }
      if (!division) {
        const m = rowStr.match(/DIVISION[:\s]+(.+?)(?:\t|$)/i)
        if (m) division = m[1].trim()
      }
    }
    if (schoolName && teacherName && gradeSection) break
  }

  // ── Parse each subject sheet ───────────────────────────────────────────────
  const sheets  = []
  const warnings = []

  for (const sheetName of wb.SheetNames) {
    if (/input data|do not delete|rizal final|summary|transmut/i.test(sheetName)) continue

    const ws = wb.Sheets[sheetName]
    if (!ws) continue
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true })
    if (!raw || raw.length < 8) continue

    // Subject name
    let subject = sheetName.replace(/_Q\d$/i, '').replace(/_/g, ' ').trim().toUpperCase()
    let quarter = null

    for (let i = 0; i < Math.min(12, raw.length); i++) {
      const rowStr = raw[i].map(c => String(c || '')).join(' ')
      const rowUp  = rowStr.toUpperCase()

      const qm = rowUp.match(/\b(FIRST|SECOND|THIRD|FOURTH|1ST|2ND|3RD|4TH)\s+QUARTER/)
      if (qm && !quarter) {
        const map = { FIRST:'1st','1ST':'1st', SECOND:'2nd','2ND':'2nd', THIRD:'3rd','3RD':'3rd', FOURTH:'4th','4TH':'4th' }
        quarter = map[qm[1].toUpperCase()] || '4th'
      }
      const sm = rowStr.match(/SUBJECT[:\s]+(.+?)(?:\t|$)/i)
      if (sm && sm[1].trim().length > 1 && sm[1].trim() !== '0') {
        subject = sm[1].trim().toUpperCase()
      }
    }

    if (!quarter) {
      const qm = sheetName.match(/Q(\d)/i)
      quarter = qm ? { '1':'1st','2':'2nd','3':'3rd','4':'4th' }[qm[1]] || '4th' : '4th'
    }

    // Column positions
    const colMap = findColumnMap(raw)

    // Student section boundaries
    let maleStart = -1, femaleStart = -1
    for (let i = 0; i < raw.length; i++) {
      const joined = raw[i].map(c => String(c || '')).join('').trim().toUpperCase()
      const c0     = String(raw[i][0] || '').trim().toUpperCase()
      const c1     = String(raw[i][1] || '').trim().toUpperCase()
      if (joined === 'MALE'   || c0 === 'MALE'   || c1 === 'MALE')   maleStart   = i + 1
      if (joined === 'FEMALE' || c0 === 'FEMALE' || c1 === 'FEMALE') femaleStart = i + 1
    }

    if (maleStart === -1) { warnings.push(`${sheetName}: No MALE section found`); continue }

    const students = []

    const isStop = (row) => {
      const c0  = String(row[0] || '').trim().toUpperCase()
      const c1  = String(row[1] || '').trim().toUpperCase()
      const all = row.map(c => String(c || '')).join('').trim().toUpperCase()
      if (!all || all === '0') return true
      return /^(FEMALE|MEAN|%\s*OF|PREPARED|NOTED|CLASS|HIGHEST)/.test(c0)
          || /^(FEMALE|MEAN|%\s*OF|PREPARED|NOTED|CLASS|HIGHEST)/.test(c1)
    }

    const isName = (s) => s && s !== '0' && s.length >= 4 && /[A-Za-zÑñ]/.test(s) && !/^\d+$/.test(s)

    const parseRows = (start, gender) => {
      for (let i = start; i < raw.length; i++) {
        const row  = raw[i]
        if (isStop(row)) break
        const name = String(row[1] || '').trim()
        if (!isName(name)) continue

        let wwScores = [], ptScores = [], qaScores = []
        let wwPS = null, ptPS = null, qaPS = null, initialGrade = null

        if (colMap) {
          const g = (col) => {
            if (col < 0 || col >= row.length) return null
            const v = row[col]
            if (v === '' || v === null || v === undefined) return null
            const n = Number(v)
            return isNaN(n) ? null : n
          }

          // Individual item scores
          wwScores = colMap.wwItemCols.map(({ col, maxScore }) => ({ score: g(col), maxScore }))
          ptScores = colMap.ptItemCols.map(({ col, maxScore }) => ({ score: g(col), maxScore }))
          qaScores = colMap.qaItemCols.map(({ col, maxScore }) => ({ score: g(col), maxScore }))

          // Also grab PS cols as fallback for grade computation
          wwPS         = g(colMap.wwPsCol)
          ptPS         = g(colMap.ptPsCol)
          qaPS         = g(colMap.qaPsCol)
          initialGrade = colMap.initialGradeCol >= 0 ? g(colMap.initialGradeCol) : null
        } else {
          // Fallback — no individual items available
          const nums = []
          for (let c = 2; c < row.length; c++) {
            const v = row[c]
            if (v !== '' && v !== null && !isNaN(Number(v))) nums.push({ col: c, val: Number(v) })
          }
          const ps = nums.filter(x => x.val > 50 && x.val <= 100)
          if (ps.length >= 3) { wwPS = ps[0].val; ptPS = ps[1].val; qaPS = ps[2].val; initialGrade = ps[3]?.val ?? null }
          else if (ps.length === 2) { wwPS = ps[0].val; ptPS = ps[1].val }
          const late = nums.filter(x => x.col > row.length - 8 && x.val >= 60 && x.val <= 100 && !Number.isInteger(x.val))
          if (!initialGrade && late.length) initialGrade = late[0].val
        }

        students.push({ name, gender, wwScores, ptScores, qaScores, wwPS, ptPS, qaPS, initialGrade })
      }
    }

    parseRows(maleStart, 'M')
    if (femaleStart > -1) parseRows(femaleStart, 'F')

    if (!students.length) { warnings.push(`${sheetName}: No students found`); continue }

    sheets.push({ sheetName, subject, quarter, weights: getWeights(subject), students, colMapFound: !!colMap })
  }

  return {
    sheets, warnings,
    meta: { schoolName, schoolId, schoolYear, teacherName, gradeSection, district, division },
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function r2(n) { return Math.round(Number(n) * 100) / 100 }

function computeInitial(st, w) {
  const { wwPS, ptPS, qaPS, initialGrade } = st
  if (wwPS !== null && ptPS !== null && qaPS !== null)
    return r2((wwPS * w.ww) + (ptPS * w.pt) + (qaPS * w.qa))
  if (initialGrade !== null && initialGrade !== undefined) return r2(initialGrade)
  return null
}

function GradeBadge({ grade }) {
  if (grade === null || grade === undefined) return <span className="text-gray-400 text-xs">—</span>
  const t   = transmute(grade)
  const cls = t >= 90 ? 'bg-green-100 text-green-800 border-green-200'
            : t >= 85 ? 'bg-blue-100 text-blue-800 border-blue-200'
            : t >= 80 ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
            :            'bg-red-100 text-red-800 border-red-200'
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="font-mono text-xs text-gray-500">{Number(grade).toFixed(2)}</span>
      <Badge className={`text-xs ${cls}`}>{t}</Badge>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DepEdImporter({ onBack }) {
  const fileInputRef = useRef(null)

  const [step, setStep]       = useState('upload') // upload | review | importing | done
  const [parsed, setParsed]   = useState(null)     // { sheets, warnings, meta }
  const [meta, setMeta]       = useState(null)     // editable copy of parsed.meta
  const [expandedSheet, setExpandedSheet] = useState(null)
  const [importLog, setImportLog] = useState([])
  const [progress, setProgress]   = useState({ current: 0, total: 0, label: '' })

  // ── File handler ────────────────────────────────────────────────────────────
  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    toast.loading('Reading E-Class Record…', { id: 'parse' })
    try {
      const result = await parseDepEdExcel(file)
      toast.dismiss('parse')

      if (!result.sheets.length) {
        toast.error('No subject sheets found. Check the file format.')
        return
      }

      setParsed(result)
      // Make an editable copy of meta so user can fix anything
      setMeta({ ...result.meta })
      setExpandedSheet(result.sheets[0].sheetName)
      setStep('review')
      toast.success(`Found ${result.sheets.length} subject sheet${result.sheets.length !== 1 ? 's' : ''}`)
    } catch (err) {
      toast.dismiss('parse')
      toast.error('Parse error: ' + (err?.message || 'unknown'))
      console.error(err)
    }
  }

  // ── Import handler ──────────────────────────────────────────────────────────
  const handleImport = async () => {
    if (!parsed || !meta) return

    setStep('importing')
    const log     = []
    const sheets  = parsed.sheets
    const total   = sheets.length  // one tick per subject sheet
    let   current = 0

    const tick = (label) => {
      current++
      setProgress({ current, total, label })
    }

    try {
      // ── STEP A: Create one course per subject, with shared students ───────────
      const normName = (s) => s.trim().toUpperCase().replace(/\s+/g, ' ')

      for (const sheet of sheets) {
        const { subject, quarter, weights, students } = sheet
        const code = subjectCode(subject)
        const section = meta.gradeSection || ''
        const courseName = subject.charAt(0) + subject.slice(1).toLowerCase()

        tick(`Creating course: ${subject}…`)

        // Create course for this subject
        const cResp = await fetch('/api/courses', {
          method: 'POST',
          headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'X-CSRF-TOKEN': getToken() },
          credentials: 'same-origin',
          body: JSON.stringify({
            course_code:   code + (section ? '-' + section.replace(/\s/g, '') : ''),
            course_name:   courseName,
            description:   [meta.schoolName, meta.gradeSection, meta.schoolYear].filter(Boolean).join(' | '),
            academic_term: meta.schoolYear || '',
            section:       section,
          }),
        })
        if (!cResp.ok) {
          log.push(`⚠ Could not create course for ${subject} (${cResp.status})`)
          continue
        }
        const cData = await cResp.json()
        const courseId = cData.id
        if (!courseId) { log.push(`⚠ No course ID returned for ${subject}`); continue }

        // Import only the students from this sheet into this course
        const studentRows = students
          .filter(st => st.name && st.name !== '0')
          .map((st, i) => ({
            student_number: String(i + 1).padStart(3, '0'),
            name:           st.name,
            email:          null,
          }))

        const sResp = await fetch('/api/students/import', {
          method: 'POST',
          headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'X-CSRF-TOKEN': getToken() },
          credentials: 'same-origin',
          body: JSON.stringify({ course_id: courseId, students: studentRows }),
        })
        if (!sResp.ok) { log.push(`⚠ Student import failed for ${subject}`); continue }

        // Fetch student ID map for this course
        const listResp = await fetch(`/api/students?course_id=${courseId}`, {
          headers: { 'Accept': 'application/json', 'X-CSRF-TOKEN': getToken() },
          credentials: 'same-origin',
        })
        const listData = await listResp.json()
        const studentMap = new Map(
          (listData.students || []).map(s => [normName(s.name), s.id])
        )

        // Create gradebook assessments — one per individual item
        const postAssessment = async (name, type, maxScore, weight) => {
          const r = await fetch('/api/gradebook/assessments', {
            method: 'POST',
            headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'X-CSRF-TOKEN': getToken() },
            credentials: 'same-origin',
            body: JSON.stringify({ course_id: courseId, grading_period: quarter, name, type, max_score: maxScore, weight }),
          })
          if (!r.ok) return null
          const d = await r.json()
          return d?.assessment?.id ?? null
        }

        // Get item definitions from the first student that has data
        const sampleStudent = students.find(st => st.wwScores?.length || st.ptScores?.length || st.qaScores?.length)
        const wwItems  = sampleStudent?.wwScores || []
        const ptItems  = sampleStudent?.ptScores || []
        const qaItems  = sampleStudent?.qaScores || []

        // Per-item weight = group weight / item count (integer, min 1)
        const wwItemWeight = wwItems.length > 0 ? Math.max(1, Math.round((weights.ww * 100) / wwItems.length)) : 0
        const ptItemWeight = ptItems.length > 0 ? Math.max(1, Math.round((weights.pt * 100) / ptItems.length)) : 0
        const qaItemWeight = qaItems.length > 0 ? Math.max(1, Math.round((weights.qa * 100) / qaItems.length)) : 0

        // Create WW assessments
        const wwIds = []
        for (let i = 0; i < wwItems.length; i++) {
          const id = await postAssessment(`WW${i + 1}`, 'activity', wwItems[i].maxScore || 10, wwItemWeight)
          wwIds.push(id)
        }

        // Create PT assessments
        const ptIds = []
        for (let i = 0; i < ptItems.length; i++) {
          const id = await postAssessment(`PT${i + 1}`, 'project', ptItems[i].maxScore || 10, ptItemWeight)
          ptIds.push(id)
        }

        // Create QA assessments
        const qaIds = []
        for (let i = 0; i < qaItems.length; i++) {
          const id = await postAssessment(`QA${i + 1}`, 'exam', qaItems[i].maxScore || 40, qaItemWeight)
          qaIds.push(id)
        }

        // Fallback: if no individual items parsed, create 3 summary assessments
        let fallbackWwId = null, fallbackPtId = null, fallbackQaId = null
        if (!wwIds.length && !ptIds.length && !qaIds.length) {
          fallbackWwId = await postAssessment('Written Works',        'activity', 100, Math.round(weights.ww * 100))
          fallbackPtId = await postAssessment('Performance Tasks',    'project',  100, Math.round(weights.pt * 100))
          fallbackQaId = await postAssessment('Quarterly Assessment', 'exam',     100, Math.round(weights.qa * 100))
        }

        // Build grade rows
        const gradeRows = []
        let matched = 0, unmatched = 0

        for (const st of students) {
          const sid = studentMap.get(normName(st.name))
          if (!sid) { unmatched++; continue }
          matched++

          if (wwIds.length > 0) {
            for (let i = 0; i < wwIds.length; i++) {
              const score = st.wwScores?.[i]?.score
              if (wwIds[i] && score !== null && score !== undefined) {
                gradeRows.push({ student_id: Number(sid), assessment_id: Number(wwIds[i]), score: r2(score) })
              }
            }
          } else if (fallbackWwId && st.wwPS !== null) {
            gradeRows.push({ student_id: Number(sid), assessment_id: Number(fallbackWwId), score: r2(st.wwPS) })
          }

          if (ptIds.length > 0) {
            for (let i = 0; i < ptIds.length; i++) {
              const score = st.ptScores?.[i]?.score
              if (ptIds[i] && score !== null && score !== undefined) {
                gradeRows.push({ student_id: Number(sid), assessment_id: Number(ptIds[i]), score: r2(score) })
              }
            }
          } else if (fallbackPtId && st.ptPS !== null) {
            gradeRows.push({ student_id: Number(sid), assessment_id: Number(fallbackPtId), score: r2(st.ptPS) })
          }

          if (qaIds.length > 0) {
            for (let i = 0; i < qaIds.length; i++) {
              const score = st.qaScores?.[i]?.score
              if (qaIds[i] && score !== null && score !== undefined) {
                gradeRows.push({ student_id: Number(sid), assessment_id: Number(qaIds[i]), score: r2(score) })
              }
            }
          } else if (fallbackQaId && st.qaPS !== null) {
            gradeRows.push({ student_id: Number(sid), assessment_id: Number(fallbackQaId), score: r2(st.qaPS) })
          }
        }

        if (gradeRows.length > 0) {
          const gResp = await fetch('/api/gradebook/grades', {
            method: 'PUT',
            headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'X-CSRF-TOKEN': getToken() },
            credentials: 'same-origin',
            body: JSON.stringify({ course_id: courseId, grading_period: quarter, grades: gradeRows }),
          })
          if (!gResp.ok) log.push(`⚠ Grade save failed for ${subject}`)
        }

        const totalAssessments = wwIds.length + ptIds.length + qaIds.length || 3
        const note = unmatched > 0 ? ` (${unmatched} unmatched)` : ''
        log.push(`✓ ${subject} (${quarter}) — Course created · ${matched} students · ${gradeRows.length} grades · ${totalAssessments} assessments${note}`)
      }

      setImportLog(log)
      setStep('done')
      toast.success(`Import complete! ${sheets.length} courses · ${log.filter(l => l.startsWith('✓')).length} subjects imported`)
    } catch (err) {
      toast.error('Import failed: ' + (err?.message || 'unknown'))
      console.error(err)
      setStep('review')
    }
  }

  const reset = () => {
    setParsed(null); setMeta(null); setImportLog([])
    setProgress({ current: 0, total: 0, label: '' })
    setStep('upload')
  }

  // ── RENDER ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="p-6 max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 text-gray-600">
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
          )}
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
              <FileSpreadsheet className="w-6 h-6 text-green-700" />
              DepEd E-Class Record Import
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Upload a DepEd E-Class Record workbook — courses, students, and grades are created automatically.
            </p>
          </div>
        </div>

        {/* ── UPLOAD ──────────────────────────────────────────────────────────── */}
        {step === 'upload' && (
          <>
            <Card
              className="border-2 border-dashed border-gray-300 hover:border-green-400 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <Upload className="w-8 h-8 text-green-700" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">Upload E-Class Record</h3>
                <p className="text-sm text-gray-500 mb-1">Click to browse or drag an <strong>.xlsx</strong> file</p>
                <p className="text-xs text-gray-400">Multi-sheet workbook — one sheet per subject</p>
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">What happens automatically</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="flex items-start gap-2">
                    <School className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                    <div><p className="font-medium">Courses Created</p><p className="text-xs text-gray-500">One course per subject using your account as the teacher</p></div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Users className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                    <div><p className="font-medium">Students Enrolled</p><p className="text-xs text-gray-500">All learner names imported per subject</p></div>
                  </div>
                  <div className="flex items-start gap-2">
                    <BookOpen className="w-4 h-4 text-purple-600 mt-0.5 shrink-0" />
                    <div><p className="font-medium">Grades Populated</p><p className="text-xs text-gray-500">WW, PT, QA scores with DepEd-standard weights</p></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* ── REVIEW ──────────────────────────────────────────────────────────── */}
        {step === 'review' && parsed && meta && (
          <>
            {/* Parse warnings */}
            {parsed.warnings.length > 0 && (
              <Card className="border-amber-200 bg-amber-50">
                <CardContent className="py-3 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <div className="text-xs text-amber-800 space-y-0.5">
                    {parsed.warnings.map((w, i) => <p key={i}>{w}</p>)}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Editable school metadata */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <School className="w-4 h-4 text-green-700" />
                  School Information
                  <span className="text-xs font-normal text-gray-400 ml-1">— from the file, edit if needed</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs">School Name</Label>
                    <Input value={meta.schoolName} onChange={e => setMeta(m => ({ ...m, schoolName: e.target.value }))} className="text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">School Year</Label>
                    <Input value={meta.schoolYear} onChange={e => setMeta(m => ({ ...m, schoolYear: e.target.value }))} className="text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Grade & Section</Label>
                    <Input value={meta.gradeSection} onChange={e => setMeta(m => ({ ...m, gradeSection: e.target.value }))} className="text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Teacher in File</Label>
                    <div className="flex items-center gap-2">
                      <Input value={meta.teacherName} readOnly className="text-sm bg-gray-50 text-gray-500" />
                      <Badge variant="outline" className="text-xs whitespace-nowrap text-green-700 border-green-300">→ replaced by your account</Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Courses preview */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-green-700" />
                  Courses to be created ({parsed.sheets.length})
                </CardTitle>
                <CardDescription className="text-xs">One course per subject — you will be set as the teacher</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {parsed.sheets.map(sheet => {
                    const code = subjectCode(sheet.subject) + (meta.gradeSection ? '-' + meta.gradeSection.replace(/\s/g, '') : '')
                    return (
                      <div key={sheet.sheetName} className="flex items-center gap-3 p-2 rounded-md border border-gray-200 bg-white text-sm">
                        <div className="w-10 h-10 rounded bg-green-100 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-green-700">{subjectCode(sheet.subject)}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{sheet.subject.charAt(0) + sheet.subject.slice(1).toLowerCase()}</p>
                          <p className="text-xs text-gray-400">{code} · {sheet.quarter} Quarter · {sheet.students.length} students</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Subject detail previews */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-700">Student preview per subject</p>
              {parsed.sheets.map(sheet => (
                <Card key={sheet.sheetName}>
                  <CardHeader
                    className="cursor-pointer pb-3"
                    onClick={() => setExpandedSheet(expandedSheet === sheet.sheetName ? null : sheet.sheetName)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-sm">{sheet.subject}</CardTitle>
                        <Badge variant="outline" className="text-xs">{sheet.quarter} Quarter</Badge>
                        <Badge className="text-xs bg-blue-100 text-blue-800 border-blue-200">{sheet.students.length} learners</Badge>
                        {!sheet.colMapFound && (
                          <Badge className="text-xs bg-amber-100 text-amber-800 border-amber-200">⚠ fallback parser</Badge>
                        )}
                      </div>
                      {expandedSheet === sheet.sheetName
                        ? <ChevronUp className="w-4 h-4 text-gray-400" />
                        : <ChevronDown className="w-4 h-4 text-gray-400" />
                      }
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5 flex gap-3">
                      <span>WW {Math.round(sheet.weights.ww * 100)}%</span>
                      <span>PT {Math.round(sheet.weights.pt * 100)}%</span>
                      <span>QA {Math.round(sheet.weights.qa * 100)}%</span>
                    </div>
                  </CardHeader>

                  {expandedSheet === sheet.sheetName && (
                    <CardContent className="pt-0">
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-gray-200 bg-gray-50">
                              <th className="text-left p-2 font-medium text-gray-500">#</th>
                              <th className="text-left p-2 font-medium text-gray-500">Name</th>
                              <th className="text-center p-2 font-medium text-gray-500">Sex</th>
                              <th className="text-center p-2 font-medium text-gray-500">WW</th>
                              <th className="text-center p-2 font-medium text-gray-500">PT</th>
                              <th className="text-center p-2 font-medium text-gray-500">QA</th>
                              <th className="text-center p-2 font-medium text-gray-500">Initial → Grade</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sheet.students.map((s, idx) => {
                              const initial = computeInitial(s, sheet.weights)
                              return (
                                <tr key={idx} className={`border-b border-gray-100 ${idx % 2 === 0 ? '' : 'bg-gray-50'}`}>
                                  <td className="p-2 text-gray-400">{idx + 1}</td>
                                  <td className="p-2 font-medium">{s.name}</td>
                                  <td className="p-2 text-center text-gray-400">{s.gender}</td>
                                  <td className="p-2 text-center font-mono">{s.wwPS?.toFixed(1) ?? '—'}</td>
                                  <td className="p-2 text-center font-mono">{s.ptPS?.toFixed(1) ?? '—'}</td>
                                  <td className="p-2 text-center font-mono">{s.qaPS?.toFixed(1) ?? '—'}</td>
                                  <td className="p-2 text-center"><GradeBadge grade={initial} /></td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button onClick={handleImport} className="bg-green-700 hover:bg-green-800 gap-2">
                <Upload className="w-4 h-4" /> Create Courses & Import All
              </Button>
              <Button variant="outline" onClick={reset}>Upload Different File</Button>
            </div>
          </>
        )}

        {/* ── IMPORTING ───────────────────────────────────────────────────────── */}
        {step === 'importing' && (
          <Card>
            <CardContent className="py-12 flex flex-col items-center gap-4">
              <div className="w-14 h-14 rounded-full border-4 border-green-200 border-t-green-700 animate-spin" />
              <div className="text-center">
                <p className="font-medium text-gray-900">{progress.label || 'Importing…'}</p>
                <p className="text-sm text-gray-500 mt-1">
                  Step {progress.current} of {progress.total}
                </p>
              </div>
              <div className="w-full max-w-xs bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-700 h-2 rounded-full transition-all"
                  style={{ width: progress.total > 0 ? `${(progress.current / progress.total) * 100}%` : '0%' }}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── DONE ────────────────────────────────────────────────────────────── */}
        {step === 'done' && (
          <Card className="border-green-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-800">
                <CheckCircle2 className="w-5 h-5" /> All Done
              </CardTitle>
              <CardDescription>
                Courses, students, and grades have been created. Open <strong>My Courses</strong> or <strong>Grading</strong> to review.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 mb-6">
                {importLog.map((line, i) => (
                  <li key={i} className={`flex items-start gap-2 text-sm ${line.startsWith('⚠') ? 'text-amber-700' : 'text-gray-700'}`}>
                    {line.startsWith('⚠')
                      ? <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                      : <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                    }
                    {line.replace(/^[✓⚠]\s/, '')}
                  </li>
                ))}
              </ul>
              <div className="flex gap-3">
                <Button className="bg-green-700 hover:bg-green-800" onClick={reset}>Import Another File</Button>
                {onBack && <Button variant="outline" onClick={onBack}>Go to Grading</Button>}
              </div>
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  )
}
