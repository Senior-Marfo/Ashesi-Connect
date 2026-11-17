/// API responses shaped like the backend's (web-app/backend/src/eligibility/assess.ts).
Map<String, Object?> eligibilityJson({
  String level = 'YELLOW',
  String status = 'REQUIREMENTS_REMAINING',
}) => {
  'student': {
    'studentId': '20280001',
    'fullName': 'Ama Synthetic Mensah',
    'programme': 'CS',
    'yearGroup': 2028,
    'track': 'standard',
    'synthetic': true,
  },
  'officialCertification': false,
  'status': status,
  'curriculum': {'basis': 'SYNTHETIC', 'version': 'SYNTHETIC-1'},
  'expectedGraduation': '2028 Spring',
  'audit': {
    'creditsEarned': 20,
    'creditsRequired': 34.5,
    'creditsInProgress': 4,
    'percentComplete': 57.97,
    'remainingRequirements': [
      {'code': 'CS 321', 'category': 'Major', 'credits': 1, 'reason': 'IN_PROGRESS'},
      {'code': 'MATH 141', 'category': 'Core', 'credits': 1, 'reason': 'FAILED'},
      {'code': 'CS 400', 'category': 'Capstone', 'credits': 1, 'reason': 'NOT_TAKEN'},
    ],
  },
  'standing': {
    'level': level,
    'reasons': ['FAILED_COURSE_TO_RETAKE'],
    'creditsOutstanding': 10.5,
    'termsRemaining': 3,
    'creditsPerTermNeeded': 3.5,
  },
  'requirements': [
    {
      'category': 'Major',
      'kind': 'REQUIRED',
      'creditsRequired': 2,
      'creditsCompleted': 1,
      'creditsInProgress': 1,
      'options': <String>[],
      'items': [
        {
          'code': 'CS 212',
          'credits': 1,
          'minimumGrade': 'D+',
          'state': 'COMPLETED',
          'grade': 'A',
          'attempts': 1,
        },
        {
          'code': 'CS 321',
          'credits': 1,
          'minimumGrade': 'D+',
          'state': 'IN_PROGRESS',
          'attempts': 1,
        },
      ],
    },
    {
      'category': 'Core',
      'kind': 'REQUIRED',
      'creditsRequired': 1,
      'creditsCompleted': 0,
      'creditsInProgress': 0,
      'options': <String>[],
      'items': [
        {
          'code': 'MATH 141',
          'credits': 1,
          'minimumGrade': 'C',
          'state': 'FAILED',
          'grade': 'D+',
          'attempts': 2,
        },
      ],
    },
  ],
  'nextActions': [
    {'kind': 'RETAKE', 'code': 'MATH 141', 'category': 'Core', 'credits': 1},
    {'kind': 'TAKE_COURSE', 'code': 'CS 400', 'category': 'Capstone', 'credits': 1},
  ],
  'issues': <String>[],
};

Map<String, Object?> inboxJson() => {
  'messages': [
    {
      'id': 'm2',
      'title': 'Retake MATH 141',
      'body': 'Register for the spring section.',
      'priority': 'HIGH',
      'sentAt': '2026-11-16T09:00:00Z',
    },
    {
      'id': 'm1',
      'title': 'Audit review due',
      'body': 'Check your record.',
      'priority': 'NORMAL',
      'sentAt': '2026-11-10T09:00:00Z',
      'readAt': '2026-11-11T09:00:00Z',
    },
  ],
  'unread': 1,
};
