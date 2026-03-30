export function getCourseName(course) {
  if (!course) return ''
  return course.course_name || course.name || ''
}

export function getCourseCode(course) {
  if (!course) return ''
  return course.course_code || course.code || ''
}

export function getCourseSection(course) {
  if (!course) return ''
  return course.section || ''
}

export function formatCourseLabel(course, options = {}) {
  const { includeSection = true } = options
  const name = getCourseName(course)
  const code = getCourseCode(course)
  const section = getCourseSection(course)

  let label = ''
  if (code && name) {
    label = `${code} - ${name}`
  } else if (name) {
    label = name
  } else if (code) {
    label = code
  } else {
    label = 'Untitled Course'
  }

  if (includeSection && section) {
    label += ` (Section ${section})`
  }

  return label
}
