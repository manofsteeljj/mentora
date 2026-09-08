import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Input } from './ui/input'
import {
  BookOpen,
  Filter,
  Search,
  Download,
  Save,
  FileSpreadsheet,
  TrendingUp,
  TrendingDown,
  Minus,
  Check,
  X,
} from 'lucide-react'
import { Progress } from './ui/progress'
import { formatCourseLabel } from '../lib/courseDisplay'
import OnlyOfficeEditor from './OnlyOfficeEditor'

// ─── DepEd Transmutation Table (matches the official E-Class Record "NewTransmu" table) ──
const TRANSMUTATION_TABLE = [
  [0, 39.99, 60], [40, 42.99, 61], [43, 45.99, 62], [46, 47.99, 63], [48, 49.99, 64],
  [50, 51.99, 65], [52, 53.99, 66], [54, 55.99, 67], [56, 57.99, 68], [58, 59.99, 69],
  [60, 61.99, 70], [62, 63.99, 71], [64, 65.99, 72], [66, 67.99, 73], [68, 69.99, 74],
  [70, 72.99, 75], [73, 74.99, 76], [75, 75.99, 77], [76, 76.99, 78], [77, 77.99, 79],
  [78, 78.99, 80], [79, 79.99, 81], [80, 80.99, 82], [81, 81.99, 83], [82, 82.99, 84],
  [83, 83.99, 85], [84, 84.99, 86], [85, 85.99, 87], [86, 86.99, 88], [87, 87.99, 89],
  [88, 88.99, 90], [89, 89.99, 91], [90, 90.99, 92], [91, 91.99, 93], [92, 92.99, 94],
  [93, 93.99, 95], [94, 94.99, 96], [95, 95.99, 97], [96, 97.49, 98], [97.5, 99.49, 99],
  [99.5, 100, 100],
]

// ─── DepEd Descriptor Table (matches the official template's "DESCRIPTORS" table) ────────
const DESCRIPTOR_TABLE = [
  [0, 64, 'Emerging'], [65, 74, 'Developing'], [75, 79, 'Connecting'],
  [80, 89, 'Benchmarking'], [90, 100, 'Advancing'],
]

function transmute(g) {
  g = Number(g)
  if (isNaN(g)) return null
  if (g >= 100) return 100
  if (g < 0) return 60
  for (const [lo, hi, out] of TRANSMUTATION_TABLE) {
    if (g >= lo && g <= hi) return out
  }
  return 60
}

function descriptorFor(termGrade) {
  const g = Number(termGrade)
  if (isNaN(g)) return ''
  for (const [lo, hi, label] of DESCRIPTOR_TABLE) {
    if (g >= lo && g <= hi) return label
  }
  return ''
}

// ─── Subject weights (DepEd) ──────────────────────────────────────────────────
function getWeights(subject) {
  const upper = (subject || '').toUpperCase()
  if (upper.includes('EPP') || upper.includes('TLE') || upper.includes('PANTAHANAN'))
    return { ww: 0.20, pt: 0.60, qa: 0.20 }
  // Default (matches the attached template): WW 20%, PT 50%, ST+TE 30%
  return { ww: 0.20, pt: 0.50, qa: 0.30 }
}

function termLabel(q) {
  const map = { '1st': 'TERM 1', '2nd': 'TERM 2', '3rd': 'TERM 3' }
  return map[q] || 'TERM 1'
}

// ─── Shared style constants (mirrors the official DepEd E-Class Record) ──────────────────
const THIN = { style: 'thin' }
const MEDIUM = { style: 'medium' }
const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } }
const SECTION_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBFBFBF' } }
const GENDER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } }
const HPS_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } }
const CENTER = { horizontal: 'center', vertical: 'center', wrapText: true }
const CENTER_NOWRAP = { horizontal: 'center', vertical: 'center' }

function box(top, bottom, left, right) {
  return { top: top || THIN, bottom: bottom || THIN, left: left || THIN, right: right || THIN }
}

// ─── Build one DepEd sheet (one term, one subject/section) — matches TERM1/2/3 layout exactly
function buildDepEdSheet(ExcelJS, wb, sheetName, course, students, gradebook, teacherName, schoolInfo) {
  const ws = wb.addWorksheet(sheetName.slice(0, 31), {
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
    views: [{ state: 'frozen', xSplit: 2, ySplit: 11 }],
  })

  const subject = course.course_name || ''
  const weights = getWeights(subject)
  const section = course.section || ''
  const schoolYear = course.academic_term || ''
  const period = gradebook?.period || '3rd'
  const tLabel = termLabel(period)

  const wwPct = Math.round(weights.ww * 100)
  const ptPct = Math.round(weights.pt * 100)
  const qaPct = Math.round(weights.qa * 100)

  // Column widths — A..AB, matching the official template
  ws.columns = [
    { width: 4.1 }, { width: 35.8 }, { width: 1.8 }, { width: 8 }, { width: 8 },
    { width: 4.8 }, { width: 8 }, { width: 8 }, { width: 8 }, { width: 8 },
    { width: 6.4 }, { width: 7.1 }, { width: 8 },
    { width: 4.8 }, { width: 8 }, { width: 8 },
    { width: 6.4 }, { width: 7.1 }, { width: 8 },
    { width: 4.8 }, { width: 8 }, { width: 4.8 },
    { width: 7.1 }, { width: 7.1 }, { width: 8 },
    { width: 11.4 }, { width: 11 }, { width: 14 },
  ]

  // Row 1-2: Title
  ws.mergeCells('A1:AB2')
  const titleCell = ws.getCell('A1')
  titleCell.value = 'Class Record'
  titleCell.font = { bold: true, size: 21 }
  titleCell.alignment = { horizontal: 'center', vertical: 'top' }
  ws.getRow(1).height = 15
  ws.getRow(2).height = 15

  // Row 3: subtitle
  ws.mergeCells('A3:AB3')
  ws.getCell('A3').value = '(Pursuant to DepEd Order No. 8, s. 2015)'
  ws.getCell('A3').font = { size: 9, italic: true }
  ws.getCell('A3').alignment = { horizontal: 'center' }

  // Row 4: REGION / DIVISION
  ws.mergeCells('B4:F4'); ws.mergeCells('G4:H4'); ws.mergeCells('I4:K4'); ws.mergeCells('L4:O4')
  ws.getCell('B4').value = 'REGION'
  ws.getCell('G4').value = schoolInfo?.region || ''
  ws.getCell('I4').value = 'DIVISION'
  ws.getCell('L4').value = schoolInfo?.division || ''
  for (const c of ['B4', 'I4']) {
    ws.getCell(c).font = { bold: true, size: 12 }
    ws.getCell(c).alignment = { horizontal: 'right', vertical: 'center' }
  }
  for (const c of ['G4', 'L4']) {
    ws.getCell(c).alignment = CENTER_NOWRAP
    ws.getCell(c).border = box()
  }
  ws.getRow(4).height = 21

  // Row 5: SCHOOL NAME / SCHOOL ID / SCHOOL YEAR
  ws.mergeCells('B5:F5'); ws.mergeCells('G5:O5')
  ws.mergeCells('Q5:R5'); ws.mergeCells('S5:U5')
  ws.mergeCells('V5:Y5'); ws.mergeCells('Z5:AB5')
  ws.getCell('B5').value = 'SCHOOL NAME'
  ws.getCell('G5').value = schoolInfo?.schoolName || ''
  ws.getCell('Q5').value = 'SCHOOL ID'
  ws.getCell('S5').value = schoolInfo?.schoolId || ''
  ws.getCell('V5').value = 'SCHOOL YEAR'
  ws.getCell('Z5').value = schoolYear
  for (const c of ['B5', 'Q5', 'V5']) {
    ws.getCell(c).font = { bold: true, size: 12 }
    ws.getCell(c).alignment = { horizontal: 'right', vertical: 'center' }
  }
  for (const c of ['G5', 'S5', 'Z5']) {
    ws.getCell(c).alignment = CENTER_NOWRAP
    ws.getCell(c).border = box()
  }
  ws.getRow(5).height = 21

  // Row 7: TERM / GRADE & SECTION / TEACHER / SUBJECT
  ws.mergeCells('A7:B7'); ws.mergeCells('F7:I7'); ws.mergeCells('J7:M7')
  ws.mergeCells('N7:P7'); ws.mergeCells('Q7:V7'); ws.mergeCells('X7:Y7'); ws.mergeCells('Z7:AB7')
  ws.getCell('A7').value = tLabel
  ws.getCell('A7').font = { bold: true, size: 12 }
  ws.getCell('A7').alignment = { horizontal: 'left', vertical: 'center' }
  ws.getCell('F7').value = 'GRADE & SECTION: '
  ws.getCell('J7').value = section
  ws.getCell('N7').value = 'TEACHER:'
  ws.getCell('Q7').value = teacherName || ''
  ws.getCell('X7').value = 'SUBJECT:'
  ws.getCell('Z7').value = subject
  for (const c of ['F7', 'N7', 'X7']) {
    ws.getCell(c).font = { bold: true, size: 10 }
    ws.getCell(c).alignment = { horizontal: 'right', vertical: 'center' }
  }
  for (const c of ['J7', 'Q7', 'Z7']) {
    ws.getCell(c).alignment = { horizontal: 'left', vertical: 'center' }
    ws.getCell(c).font = { bold: true }
  }
  ws.getCell('A7').border = { top: MEDIUM, left: MEDIUM }
  ws.getCell('F7').border = { top: MEDIUM, left: MEDIUM }
  ws.getRow(7).height = 23.25

  // Row 8-10: table headers (group headers row 8, item numbers row 9, HPS row 10)
  ws.mergeCells('A8:A10'); ws.mergeCells('B8:B10')
  ws.mergeCells('F8:M8'); ws.mergeCells('N8:S8'); ws.mergeCells('T8:Y8')
  ws.mergeCells('Z8:Z10'); ws.mergeCells('AA8:AA10'); ws.mergeCells('AB8:AB10')

  ws.getCell('A8').value = 'No.'
  ws.getCell('B8').value = "LEARNERS' NAMES"
  ws.getCell('F8').value = `WRITTEN / ORAL WORKS (${wwPct}%)`
  ws.getCell('N8').value = `PRODUCT / PERFORMANCE TASKS (${ptPct}%)`
  ws.getCell('T8').value = `SUMMATIVE TESTS AND TERM EXAMINATIONS (${qaPct}%)`
  ws.getCell('Z8').value = 'Initial Grade'
  ws.getCell('AA8').value = 'TERM GRADE'
  ws.getCell('AB8').value = 'DESCRIPTOR'

  const groupHeaderCells = ['A8', 'B8', 'F8', 'N8', 'T8', 'Z8', 'AA8', 'AB8']
  for (const c of groupHeaderCells) {
    const cell = ws.getCell(c)
    cell.font = { bold: true, size: c === 'B8' ? 14 : 11 }
    cell.alignment = CENTER
    cell.fill = HEADER_FILL
    cell.border = box(MEDIUM, THIN, MEDIUM, MEDIUM)
  }

  const itemRow = ws.getRow(9)
  const itemHeaders = {
    F: 1, G: 2, H: 3, I: 4, J: 5, K: 'Total', L: 'PS', M: 'WS',
    N: 1, O: 2, P: 3, Q: 'Total', R: 'PS', S: 'WS',
    T: 'ST1', U: 'ST2', V: 'TE', W: 'Total', X: 'PS', Y: 'WS',
  }
  for (const [col, val] of Object.entries(itemHeaders)) {
    const cell = ws.getCell(`${col}9`)
    cell.value = val
    cell.font = { bold: true, size: 11 }
    cell.alignment = CENTER_NOWRAP
    cell.fill = HEADER_FILL
    cell.border = box(THIN, THIN, MEDIUM, THIN)
  }
  itemRow.height = 18

  ws.getCell('B10').value = 'HIGHEST POSSIBLE SCORE'
  ws.getCell('B10').font = { bold: true, size: 11 }
  ws.getCell('B10').alignment = { horizontal: 'right' }
  ws.getCell('B10').border = box()
  ws.getCell('K10').value = 100
  ws.getCell('L10').value = 100
  ws.getCell('M10').value = weights.ww
  ws.getCell('Q10').value = 100
  ws.getCell('R10').value = 100
  ws.getCell('S10').value = weights.pt
  ws.getCell('W10').value = 100
  ws.getCell('X10').value = 100
  ws.getCell('Y10').value = weights.qa
  for (const col of ['K', 'L', 'M', 'Q', 'R', 'S', 'W', 'X', 'Y']) {
    const cell = ws.getCell(`${col}10`)
    cell.font = { bold: true, size: 11 }
    cell.alignment = CENTER_NOWRAP
    cell.fill = HPS_FILL
    cell.border = box()
    if (['M', 'S', 'Y'].includes(col)) cell.numFmt = '0%'
  }
  ws.getRow(10).height = 18
  ws.getRow(8).height = 46.75

  // ─── Grade computation (raw scores from the gradebook) ───────────────────
  const assessments = gradebook?.assessments || []
  const grades = gradebook?.grades || []
  const gradeMap = {}
  for (const g of grades) {
    if (!gradeMap[g.student_id]) gradeMap[g.student_id] = {}
    gradeMap[g.student_id][g.assessment_id] = g.score
  }
  const wwAssess = assessments.filter(a => ['activity', 'quiz'].includes(a.type))
  const ptAssess = assessments.filter(a => ['project', 'assignment'].includes(a.type))
  const qaAssess = assessments.filter(a => a.type === 'exam')

  // Writes one student row with live Excel formulas identical to the DepEd template
  const writeStudentRow = (rowNum, num, student) => {
    const row = ws.getRow(rowNum)
    const sg = gradeMap[student.id] || {}

    ws.getCell(`A${rowNum}`).value = num
    ws.getCell(`B${rowNum}`).value = student.name

    const putScores = (assessList, cols, maxSlots) => {
      for (let i = 0; i < maxSlots; i++) {
        const col = cols[i]
        const a = assessList[i]
        if (a) {
          const sc = sg[a.id]
          if (sc != null) ws.getCell(`${col}${rowNum}`).value = Number(sc)
        }
      }
    }
    putScores(wwAssess, ['F', 'G', 'H', 'I', 'J'], 5)
    putScores(ptAssess, ['N', 'O', 'P'], 3)
    putScores(qaAssess, ['T', 'U', 'V'], 3)

    // Totals / PS / WS — live formulas, same logic as the official template
    ws.getCell(`K${rowNum}`).value = { formula: `IF(COUNT($F${rowNum}:$J${rowNum})=0,"",SUM($F${rowNum}:$J${rowNum}))` }
    ws.getCell(`L${rowNum}`).value = { formula: `IF($K${rowNum}="","",ROUND(($K${rowNum}/$K$10)*$L$10,2))` }
    ws.getCell(`M${rowNum}`).value = { formula: `IF($L${rowNum}="","",ROUND($L${rowNum}*$M$10,2))` }
    ws.getCell(`Q${rowNum}`).value = { formula: `IF(COUNT($N${rowNum}:$P${rowNum})=0,"",SUM($N${rowNum}:$P${rowNum}))` }
    ws.getCell(`R${rowNum}`).value = { formula: `IF($Q${rowNum}="","",ROUND(($Q${rowNum}/$Q$10)*$R$10,2))` }
    ws.getCell(`S${rowNum}`).value = { formula: `IF($R${rowNum}="","",ROUND($R${rowNum}*$S$10,2))` }
    ws.getCell(`W${rowNum}`).value = { formula: `IF(COUNT($T${rowNum}:$V${rowNum})=0,"",SUM($T${rowNum}:$V${rowNum}))` }
    ws.getCell(`X${rowNum}`).value = { formula: `IF($W${rowNum}="","",ROUND(($W${rowNum}/$W$10)*$X$10,2))` }
    ws.getCell(`Y${rowNum}`).value = { formula: `IF($X${rowNum}="","",ROUND($X${rowNum}*$Y$10,2))` }
    ws.getCell(`Z${rowNum}`).value = { formula: `IF($W${rowNum}="","",ROUND(SUM($M${rowNum},$S${rowNum},$Y${rowNum}),2))` }

    // Term grade (transmuted) & descriptor — computed in JS since named-range VLOOKUP
    // needs a helper sheet; values match the official transmutation/descriptor tables.
    let wwMax = 0, ptMax = 0, qaMax = 0
    for (let i = 0; i < Math.min(wwAssess.length, 5); i++) if (sg[wwAssess[i].id] != null) wwMax += Number(wwAssess[i].max_score || 100)
    for (let i = 0; i < Math.min(ptAssess.length, 3); i++) if (sg[ptAssess[i].id] != null) ptMax += Number(ptAssess[i].max_score || 100)
    for (let i = 0; i < Math.min(qaAssess.length, 3); i++) if (sg[qaAssess[i].id] != null) qaMax += Number(qaAssess[i].max_score || 40)

    let initialGrade = null
    if (wwMax > 0 || ptMax > 0 || qaMax > 0) {
      const wwRaw = wwAssess.slice(0, 5).reduce((s, a) => s + (sg[a.id] != null ? Number(sg[a.id]) : 0), 0)
      const ptRaw = ptAssess.slice(0, 3).reduce((s, a) => s + (sg[a.id] != null ? Number(sg[a.id]) : 0), 0)
      const qaRaw = qaAssess.slice(0, 3).reduce((s, a) => s + (sg[a.id] != null ? Number(sg[a.id]) : 0), 0)
      const wwPs = wwMax > 0 ? (wwRaw / wwMax) * 100 : null
      const ptPs = ptMax > 0 ? (ptRaw / ptMax) * 100 : null
      const qaPs = qaMax > 0 ? (qaRaw / qaMax) * 100 : null
      if (wwPs != null && ptPs != null && qaPs != null) {
        initialGrade = Math.round((wwPs * weights.ww + ptPs * weights.pt + qaPs * weights.qa) * 100) / 100
      }
    } else {
      const periodKey = { '1st': 'first', '2nd': 'second', '3rd': 'third' }[period]
      const avg = student.grades?.[periodKey]
      if (avg != null) initialGrade = Math.round(avg * 100) / 100
    }

    if (initialGrade != null) {
      const termGrade = transmute(initialGrade)
      ws.getCell(`AA${rowNum}`).value = termGrade
      ws.getCell(`AB${rowNum}`).value = descriptorFor(termGrade)
    }

    for (const col of ['A', 'B', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'AA', 'AB']) {
      const cell = ws.getCell(`${col}${rowNum}`)
      cell.font = cell.font || { size: 11 }
      cell.alignment = col === 'B' ? { horizontal: 'left', vertical: 'center' } : CENTER_NOWRAP
      cell.border = box(THIN, THIN, col === 'A' ? MEDIUM : THIN, col === 'AB' ? MEDIUM : THIN)
      if (['L', 'M', 'R', 'S', 'X', 'Y', 'Z', 'AA', 'AB'].includes(col)) cell.font = { bold: true, size: 11 }
    }
    row.height = 18
  }

  // ─── MALE / FEMALE sections ───────────────────────────────────────────────
  const males = students.filter(s => (s.gender || '').toUpperCase() !== 'F')
  const females = students.filter(s => (s.gender || '').toUpperCase() === 'F')

  let r = 11
  ws.mergeCells(`A${r}:AB${r}`)
  ws.getCell(`A${r}`).value = 'MALE'
  ws.getCell(`A${r}`).font = { bold: true, size: 11 }
  ws.getCell(`A${r}`).fill = GENDER_FILL
  ws.getCell(`A${r}`).border = box(THIN, undefined, MEDIUM, MEDIUM)
  r++

  males.forEach((s, i) => { writeStudentRow(r, i + 1, s); r++ })

  ws.mergeCells(`A${r}:AB${r}`)
  ws.getCell(`A${r}`).value = 'FEMALE'
  ws.getCell(`A${r}`).font = { bold: true, size: 11 }
  ws.getCell(`A${r}`).fill = GENDER_FILL
  ws.getCell(`A${r}`).border = box(THIN, undefined, MEDIUM, MEDIUM)
  r++

  females.forEach((s, i) => { writeStudentRow(r, i + 1, s); r++ })

  // ─── MEAN / % OF MASTERY ──────────────────────────────────────────────────
  r++
  ws.getCell(`B${r}`).value = 'MEAN'
  ws.getCell(`B${r}`).font = { bold: true }
  ws.getCell(`AA${r}`).value = { formula: `IFERROR(ROUND(AVERAGE(AA12:AA${r - 3}),2),"")` }
  ws.getCell(`AA${r}`).font = { bold: true }
  ws.getCell(`AA${r}`).alignment = CENTER_NOWRAP
  r++
  ws.getCell(`B${r}`).value = '% OF MASTERY (75 & above)'
  ws.getCell(`B${r}`).font = { bold: true }
  ws.getCell(`AA${r}`).value = { formula: `IFERROR(ROUND(COUNTIF(AA12:AA${r - 4},">=75")/COUNT(AA12:AA${r - 4})*100,2),"")` }
  ws.getCell(`AA${r}`).font = { bold: true }
  ws.getCell(`AA${r}`).alignment = CENTER_NOWRAP
  ws.getCell(`AB${r}`).value = '%'

  // ─── Signature block ───────────────────────────────────────────────────────
  r += 2
  ws.getCell(`B${r}`).value = 'Prepared by:'
  ws.getCell(`B${r}`).font = { bold: true }
  ws.getCell(`J${r}`).value = 'Noted by:'
  ws.getCell(`J${r}`).font = { bold: true }
  r += 2
  ws.mergeCells(`B${r}:H${r}`)
  ws.getCell(`B${r}`).value = (teacherName || '').toUpperCase()
  ws.getCell(`B${r}`).font = { bold: true, underline: true }
  ws.getCell(`B${r}`).alignment = { horizontal: 'center' }
  r++
  ws.getCell(`B${r}`).value = 'Teacher'
  ws.getCell(`B${r}`).alignment = { horizontal: 'center' }
  ws.mergeCells(`B${r}:H${r}`)
}

// ─── Export entry point ───────────────────────────────────────────────────────
async function exportDepEdExcel(courses, classRows, gradebookByCourse, teacherName, schoolInfo) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = teacherName || 'Class Record'
  wb.created = new Date()

  const studentsByCourse = {}
  for (const s of classRows) {
    const cid = String(s.courseId || '')
    if (!studentsByCourse[cid]) studentsByCourse[cid] = []
    studentsByCourse[cid].push(s)
  }

  let sheetsCreated = 0
  for (const course of courses) {
    const cid = String(course.id)
    const courseStudents = studentsByCourse[cid] || []
    if (!courseStudents.length) continue
    const gradebook = gradebookByCourse[cid] || null
    const sheetName = (course.course_code || course.course_name || 'SUBJ').replace(/[^A-Za-z0-9_\-]/g, '_').slice(0, 28)
    buildDepEdSheet(ExcelJS, wb, sheetName, course, courseStudents, gradebook, teacherName, schoolInfo)
    sheetsCreated++
  }

  if (!sheetsCreated) {
    wb.addWorksheet('Sheet1').getCell('A1').value = 'No data'
  }

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ClassRecord_${new Date().toISOString().slice(0, 10)}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function ClassRecord() {
  const [courses, setCourses] = useState([])
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [showOOEditor, setShowOOEditor] = useState(false)
  const [ooDocId, setOoDocId] = useState(null)
  const [ooDocTitle, setOoDocTitle] = useState('')
  const [teacherName, setTeacherName] = useState('')
  const [schoolInfo, setSchoolInfo] = useState({ region: '', division: '', schoolName: '', schoolId: '' })
  const [gradebookByCourse, setGradebookByCourse] = useState({})

  const [selectedCourse, setSelectedCourse] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [editingCell, setEditingCell] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [gradeOverrides, setGradeOverrides] = useState({})

  function getToken() {
    return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
  }

  const fetchCourses = useCallback(async () => {
    const res = await fetch('/api/courses', {
      headers: { 'Accept': 'application/json', 'X-CSRF-TOKEN': getToken() },
      credentials: 'same-origin',
    })
    if (!res.ok) throw new Error('Failed to load courses')
    const data = await res.json()
    setCourses(Array.isArray(data) ? data : [])
  }, [])

  const fetchStudents = useCallback(async (courseId) => {
    setLoading(true)
    try {
      const url = courseId
        ? `/api/students?course_id=${encodeURIComponent(courseId)}`
        : '/api/students'

      const res = await fetch(url, {
        headers: { 'Accept': 'application/json', 'X-CSRF-TOKEN': getToken() },
        credentials: 'same-origin',
      })
      if (!res.ok) throw new Error('Failed to load students')
      const data = await res.json()
      setStudents(data.students || [])
      setError(null)
    } catch (e) {
      setError(e?.message || 'Failed to load students')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCourses().catch(() => {})
  }, [fetchCourses])

  useEffect(() => {
    fetchStudents(selectedCourse).catch(() => {})
  }, [selectedCourse, fetchStudents])

  // Fetch logged-in user name for the teacher field in export
  useEffect(() => {
    fetch('/api/user', {
      headers: { 'Accept': 'application/json', 'X-CSRF-TOKEN': getToken() },
      credentials: 'same-origin',
    })
      .then(r => r.ok ? r.json() : {})
      .then(data => {
        setTeacherName(data?.name || '')
        setSchoolInfo({
          region: data?.region || '',
          division: data?.division || '',
          schoolName: data?.school_name || data?.schoolName || '',
          schoolId: data?.school_id || data?.schoolId || '',
        })
      })
      .catch(() => {})
  }, [])

  // Fetch gradebook assessments + grades for export
  useEffect(() => {
    if (!courses.length) return
    const coursesToFetch = selectedCourse
      ? [selectedCourse]
      : courses.map(c => c.id)
    const periods = ['1st', '2nd', '3rd']

    Promise.all(
      coursesToFetch.flatMap(courseId =>
        periods.map(period =>
          Promise.all([
            fetch(`/api/gradebook/assessments?course_id=${courseId}&grading_period=${encodeURIComponent(period)}`, {
              headers: { 'Accept': 'application/json', 'X-CSRF-TOKEN': getToken() },
              credentials: 'same-origin',
            }).then(r => r.ok ? r.json() : { assessments: [] }),
            fetch(`/api/gradebook/grades?course_id=${courseId}&grading_period=${encodeURIComponent(period)}`, {
              headers: { 'Accept': 'application/json', 'X-CSRF-TOKEN': getToken() },
              credentials: 'same-origin',
            }).then(r => r.ok ? r.json() : { grades: [] }),
          ]).then(([aData, gData]) => ({
            courseId: String(courseId),
            period,
            assessments: aData.assessments || [],
            grades: gData.grades || [],
          }))
        )
      )
    )
      .then(results => {
        // Pick the period with the most grade data per course
        const map = {}
        for (const result of results) {
          const cid = result.courseId
          const score = result.grades.length + result.assessments.length
          if (!map[cid] || score > (map[cid].grades.length + map[cid].assessments.length)) {
            map[cid] = result
          }
        }
        setGradebookByCourse(map)
      })
      .catch(() => {})
  }, [courses, selectedCourse])

  const courseOptions = useMemo(() => {
    return courses.map(c => ({
      id: String(c.id),
      label: formatCourseLabel(c),
    }))
  }, [courses])

  // Auto-select first course once courses load
  useEffect(() => {
    if (!selectedCourse && courseOptions.length > 0) {
      setSelectedCourse(courseOptions[0].id)
    }
  }, [courseOptions, selectedCourse])

  const splitIntoThree = (items) => {
    const n = items.length
    if (n === 0) return [[], [], []]
    const base = Math.floor(n / 3)
    const rem = n % 3
    const sizes = [0, 1, 2].map(i => base + (i < rem ? 1 : 0))
    const result = []
    let cursor = 0
    for (const size of sizes) {
      result.push(items.slice(cursor, cursor + size))
      cursor += size
    }
    return result
  }

  const averagePercent = (items) => {
    const scored = items.filter(a => a && a.score !== null && a.score !== undefined)
    if (scored.length === 0) return null
    const sum = scored.reduce((acc, a) => {
      const max = Number(a.maxScore || 100) || 100
      const score = Number(a.score)
      if (!Number.isFinite(score) || max <= 0) return acc
      return acc + (score / max) * 100
    }, 0)
    return sum / scored.length
  }

  const classRows = useMemo(() => {
    return students.map(s => {
      const activities = Array.isArray(s.activities) ? s.activities : []
      const scoredSorted = activities
        .filter(a => a && a.score !== null && a.score !== undefined)
        .slice()
        .sort((a, b) => {
          const da = new Date(a.submittedDate || 0).getTime()
          const db = new Date(b.submittedDate || 0).getTime()
          return da - db
        })

      const [p1, p2, p3] = splitIntoThree(scoredSorted)

      const computed = {
        first: averagePercent(p1),
        second: averagePercent(p2),
        third: averagePercent(p3),
        final: s.average !== null && s.average !== undefined ? Number(s.average) : averagePercent(scoredSorted),
      }

      const pick = (period) => {
        const key = `${s.id}:${period}`
        if (Object.prototype.hasOwnProperty.call(gradeOverrides, key)) return gradeOverrides[key]
        return computed[period]
      }

      return {
        id: String(s.id),
        name: s.name,
        studentNumber: s.studentNumber || s.student_number || '',
        courseId: String(s.course?.id || ''),
        courseLabel: s.course ? `${s.course.course_code} - ${s.course.course_name}` : '—',
        section: s.course?.section || '—',
        grades: {
          first: pick('first'),
          second: pick('second'),
          third: pick('third'),
          final: pick('final'),
        },
      }
    })
  }, [students, gradeOverrides])

  const filteredStudents = useMemo(() => {
    return classRows.filter(student => {
      const matchesCourse = selectedCourse ? student.courseId === selectedCourse : false
      const matchesSearch =
        student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(student.studentNumber || '').includes(searchQuery)
      return matchesCourse && matchesSearch
    })
  }, [classRows, selectedCourse, searchQuery])

  const getGradeColor = (grade) => {
    if (grade === null || grade === undefined) return 'text-gray-400'
    if (grade >= 90) return 'text-green-600'
    if (grade >= 80) return 'text-blue-600'
    if (grade >= 75) return 'text-yellow-600'
    return 'text-white' // White text for red badges (failing grades)
  }

  const getGradeBadgeVariant = (grade) => {
    if (grade === null || grade === undefined) return 'outline'
    if (grade >= 90) return 'default'
    if (grade >= 80) return 'secondary'
    if (grade >= 75) return 'outline'
    return 'destructive'
  }

  const getPerformanceIcon = (grade) => {
    if (grade === null || grade === undefined) return <Minus className="w-4 h-4" />
    if (grade >= 85) return <TrendingUp className="w-4 h-4" />
    if (grade >= 75) return <Minus className="w-4 h-4" />
    return <TrendingDown className="w-4 h-4" />
  }

  const calculateClassAverage = (period) => {
    const validGrades = filteredStudents
      .map(s => {
        return s.grades?.[period]
      })
      .filter(g => g !== null && g !== undefined)

    if (validGrades.length === 0) return 0
    return validGrades.reduce((sum, grade) => sum + grade, 0) / validGrades.length
  }

  const handleEditGrade = (studentId, period, currentValue) => {
    setEditingCell({ studentId, period })
    setEditValue(currentValue !== null && currentValue !== undefined ? String(currentValue) : '')
  }

  const handleSaveGrade = () => {
    if (!editingCell) return
    const parsed = Number.parseFloat(editValue)
    const next = Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : null

    setGradeOverrides(prev => ({
      ...prev,
      [`${editingCell.studentId}:${editingCell.period}`]: next,
    }))

    setEditingCell(null)
    setEditValue('')
  }

  const handleCancelEdit = () => {
    setEditingCell(null)
    setEditValue('')
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const exportCourses = selectedCourse
        ? courses.filter(c => String(c.id) === selectedCourse)
        : courses
      await exportDepEdExcel(exportCourses, classRows, gradebookByCourse, teacherName, schoolInfo)
    } catch (err) {
      console.error('Export failed:', err)
    } finally {
      setExporting(false)
    }
  }

  // Export XLSX then upload it to Laravel and open in ONLYOFFICE
  const handleOpenInOnlyOffice = async () => {
    setExporting(true)
    try {
      const exportCourses = selectedCourse
        ? courses.filter(c => String(c.id) === selectedCourse)
        : courses
      if (!exportCourses.length) return

      // Build the workbook buffer in-memory
      const ExcelJS = (await import('exceljs')).default
      const wb = new ExcelJS.Workbook()
      wb.creator = teacherName || 'Class Record'
      wb.created = new Date()

      const studentsByCourse = {}
      for (const s of classRows) {
        const cid = String(s.courseId || '')
        if (!studentsByCourse[cid]) studentsByCourse[cid] = []
        studentsByCourse[cid].push(s)
      }

      for (const course of exportCourses) {
        const cid = String(course.id)
        const courseStudents = studentsByCourse[cid] || []
        if (!courseStudents.length) continue
        const gradebook = gradebookByCourse[cid] || null
        const sheetName = (course.course_code || course.course_name || 'SUBJ')
          .replace(/[^A-Za-z0-9_\-]/g, '_').slice(0, 28)
        buildDepEdSheet(ExcelJS, wb, sheetName, course, courseStudents, gradebook, teacherName, schoolInfo)
      }

      const buffer = await wb.xlsx.writeBuffer()
      const title = exportCourses[0]
        ? (exportCourses[0].course_code || exportCourses[0].course_name || 'ClassRecord')
        : 'ClassRecord'

      // Upload to Laravel to get a document ID
      const fd = new FormData()
      fd.append('file', new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }), `${title}.xlsx`)
      fd.append('title', title)

      const res = await fetch('/api/documents/class-record/upload', {
        method: 'POST',
        headers: { 'X-CSRF-TOKEN': getToken(), Accept: 'application/json' },
        credentials: 'same-origin',
        body: fd,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || `Upload failed (${res.status})`)
      }

      const data = await res.json()
      setOoDocId(data.id)
      setOoDocTitle(data.title || title)
      setShowOOEditor(true)
    } catch (err) {
      console.error('Open in ONLYOFFICE failed:', err)
      alert('Could not open in ONLYOFFICE: ' + err.message)
    } finally {
      setExporting(false)
    }
  }

  if (showOOEditor && ooDocId) {
    return (
      <OnlyOfficeEditor
        documentType="class-record"
        documentId={ooDocId}
        title={ooDocTitle}
        onBack={() => setShowOOEditor(false)}
        onSaved={() => {}}
      />
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Class Record</h1>
              <p className="text-sm text-gray-600 mt-1">
                View and manage student grades across all grading periods
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" className="gap-2">
                <Save className="w-4 h-4" />
                Save Changes
              </Button>
              <Button
                variant="outline"
                className="gap-2 border-blue-300 text-blue-700 hover:bg-blue-50"
                onClick={handleOpenInOnlyOffice}
                disabled={exporting}
              >
                <FileSpreadsheet className="w-4 h-4" />
                {exporting ? 'Preparing…' : 'Edit in ONLYOFFICE'}
              </Button>
              <Button className="gap-2 bg-green-700 hover:bg-green-800" onClick={handleExport} disabled={exporting}>
                <Download className="w-4 h-4" />
                {exporting ? 'Exporting…' : 'Export to Excel'}
              </Button>
            </div>
          </div>

          {/* Filters and Search */}
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by name or student ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-600" />
              <select
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {courseOptions.map(course => (
                  <option key={course.id} value={course.id}>{course.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="bg-white border-b border-gray-200 p-6">
        <div className="max-w-7xl mx-auto grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-1">1st Trimester</p>
                <p className="text-2xl font-bold text-green-700">
                  {calculateClassAverage('first').toFixed(1)}%
                </p>
                <p className="text-xs text-gray-500 mt-1">Class Average</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-1">2nd Trimester</p>
                <p className="text-2xl font-bold text-blue-700">
                  {calculateClassAverage('second').toFixed(1)}%
                </p>
                <p className="text-xs text-gray-500 mt-1">Class Average</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-1">3rd Trimester</p>
                <p className="text-2xl font-bold text-purple-700">
                  {calculateClassAverage('third').toFixed(1)}%
                </p>
                <p className="text-xs text-gray-500 mt-1">Class Average</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-1">Final Grade</p>
                <p className="text-2xl font-bold text-gray-900">
                  {calculateClassAverage('final').toFixed(1)}%
                </p>
                <p className="text-xs text-gray-500 mt-1">Overall Average</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5" />
                    Student Grade Records
                  </CardTitle>
                  <CardDescription>
                    Showing {filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''}
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-sm">
                  {courseOptions.find(c => c.id === selectedCourse)?.label || 'Select a course'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {error && (
                <div className="mb-4 p-3 rounded-md border border-red-200 bg-red-50 text-sm text-red-700">
                  {error}
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-sm text-gray-700 bg-gray-50 sticky left-0">
                        Student
                      </th>
                      <th className="text-center py-3 px-4 font-semibold text-sm text-gray-700 bg-green-50">
                        1st Trimester
                      </th>
                      <th className="text-center py-3 px-4 font-semibold text-sm text-gray-700 bg-blue-50">
                        2nd Trimester
                      </th>
                      <th className="text-center py-3 px-4 font-semibold text-sm text-gray-700 bg-purple-50">
                        3rd Trimester
                      </th>
                      <th className="text-center py-3 px-4 font-semibold text-sm text-gray-700 bg-gray-50">
                        Final Grade
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((student) => (
                      <tr key={student.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-4 px-4 sticky left-0 bg-white">
                          <div>
                            <p className="font-medium text-gray-900">{student.name}</p>
                            <p className="text-sm text-gray-600">{student.studentNumber || '—'}</p>
                            <p className="text-xs text-gray-500">{student.section}</p>
                          </div>
                        </td>

                        {/* 1st Grading */}
                        <td className="py-4 px-4 text-center">
                          {editingCell?.studentId === student.id && editingCell?.period === 'first' ? (
                            <div className="flex items-center justify-center gap-1">
                              <Input
                                type="number"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="w-20 h-8 text-center"
                                min="0"
                                max="100"
                                autoFocus
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                onClick={handleSaveGrade}
                              >
                                <Check className="w-4 h-4 text-green-600" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                onClick={handleCancelEdit}
                              >
                                <X className="w-4 h-4 text-red-600" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-2">
                              <Badge
                                variant={getGradeBadgeVariant(student.grades.first)}
                                className="cursor-pointer"
                                onClick={() => handleEditGrade(student.id, 'first', student.grades.first)}
                              >
                                <span className={getGradeColor(student.grades.first)}>
                                  {student.grades.first?.toFixed(1) || 'N/A'}
                                </span>
                              </Badge>
                              {getPerformanceIcon(student.grades.first)}
                            </div>
                          )}
                          <Progress
                            value={student.grades.first || 0}
                            className="mt-2 h-1"
                          />
                        </td>

                        {/* 2nd Grading */}
                        <td className="py-4 px-4 text-center">
                          {editingCell?.studentId === student.id && editingCell?.period === 'second' ? (
                            <div className="flex items-center justify-center gap-1">
                              <Input
                                type="number"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="w-20 h-8 text-center"
                                min="0"
                                max="100"
                                autoFocus
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                onClick={handleSaveGrade}
                              >
                                <Check className="w-4 h-4 text-green-600" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                onClick={handleCancelEdit}
                              >
                                <X className="w-4 h-4 text-red-600" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-2">
                              <Badge
                                variant={getGradeBadgeVariant(student.grades.second)}
                                className="cursor-pointer"
                                onClick={() => handleEditGrade(student.id, 'second', student.grades.second)}
                              >
                                <span className={getGradeColor(student.grades.second)}>
                                  {student.grades.second?.toFixed(1) || 'N/A'}
                                </span>
                              </Badge>
                              {getPerformanceIcon(student.grades.second)}
                            </div>
                          )}
                          <Progress
                            value={student.grades.second || 0}
                            className="mt-2 h-1"
                          />
                        </td>

                        {/* 3rd Grading */}
                        <td className="py-4 px-4 text-center">
                          {editingCell?.studentId === student.id && editingCell?.period === 'third' ? (
                            <div className="flex items-center justify-center gap-1">
                              <Input
                                type="number"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="w-20 h-8 text-center"
                                min="0"
                                max="100"
                                autoFocus
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                onClick={handleSaveGrade}
                              >
                                <Check className="w-4 h-4 text-green-600" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                onClick={handleCancelEdit}
                              >
                                <X className="w-4 h-4 text-red-600" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-2">
                              <Badge
                                variant={getGradeBadgeVariant(student.grades.third)}
                                className="cursor-pointer"
                                onClick={() => handleEditGrade(student.id, 'third', student.grades.third)}
                              >
                                <span className={getGradeColor(student.grades.third)}>
                                  {student.grades.third?.toFixed(1) || 'N/A'}
                                </span>
                              </Badge>
                              {getPerformanceIcon(student.grades.third)}
                            </div>
                          )}
                          <Progress
                            value={student.grades.third || 0}
                            className="mt-2 h-1"
                          />
                        </td>

                        {/* Final Grade */}
                        <td className="py-4 px-4 text-center">
                          {editingCell?.studentId === student.id && editingCell?.period === 'final' ? (
                            <div className="flex items-center justify-center gap-1">
                              <Input
                                type="number"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="w-20 h-8 text-center"
                                min="0"
                                max="100"
                                autoFocus
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                onClick={handleSaveGrade}
                              >
                                <Check className="w-4 h-4 text-green-600" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                onClick={handleCancelEdit}
                              >
                                <X className="w-4 h-4 text-red-600" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-2">
                              <Badge
                                variant={getGradeBadgeVariant(student.grades.final)}
                                className="cursor-pointer font-bold"
                                onClick={() => handleEditGrade(student.id, 'final', student.grades.final)}
                              >
                                <span className={getGradeColor(student.grades.final)}>
                                  {student.grades.final?.toFixed(1) || 'N/A'}
                                </span>
                              </Badge>
                              {getPerformanceIcon(student.grades.final)}
                            </div>
                          )}
                          <Progress
                            value={student.grades.final || 0}
                            className="mt-2 h-1"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredStudents.length === 0 && (
                <div className="text-center py-12">
                  <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 font-medium">No students found</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Try adjusting your filters or search query
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
