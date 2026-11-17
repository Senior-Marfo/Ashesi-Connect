/** Starting points for common Registry messages; admins edit before sending. */
export const MESSAGE_TEMPLATES = [
  {
    id: 'audit-review',
    title: 'Graduation audit review due',
    body: 'Please review your graduation status in the Graduation Tracker before the end of this term. If anything in your record looks wrong, contact the Registry so it can be corrected before your final audit.',
    priority: 'NORMAL'
  },
  {
    id: 'retake-reminder',
    title: 'A required course needs a retake',
    body: 'One of your required courses is below its pass mark. Please plan to retake it in an upcoming term and speak with your academic advisor about the best time to do so.',
    priority: 'HIGH'
  },
  {
    id: 'african-studies',
    title: 'African Studies elective still needed',
    body: 'Your record does not yet include an African Studies elective, which every programme requires. Please choose one during registration for an upcoming term.',
    priority: 'NORMAL'
  },
  {
    id: 'incomplete',
    title: 'Incomplete course to resolve',
    body: 'Your record shows an incomplete course. Please contact your instructor and the Registry to agree how and when it will be completed.',
    priority: 'HIGH'
  }
] as const;
