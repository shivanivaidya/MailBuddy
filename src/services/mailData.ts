import { sampleEmails } from '@/services/sampleData'
import type { Email } from '@/types/mail'

export function loadSampleEmails(): Email[] {
  return [...sampleEmails]
}
