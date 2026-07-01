import type {
  CooperationDocument,
  CooperationDocumentStatus,
  CooperationDocumentVersion,
  CooperationGeneratedTask,
  RoleProfile,
  UserRole,
  WeightedActivityInput,
  WeightedActivityOutput,
} from '../types';
import { getRoleProfile } from './roleUtils';

export const COOPERATION_POOL_WEIGHT = 20;
export const IMPLEMENTATION_POOL_WEIGHT = 80;

export const COOPERATION_STATUS_LABELS: Record<CooperationDocumentStatus, string> = {
  usulan: 'Usulan',
  'draft-internal': 'Draft Internal',
  'review-project-head': 'Review Project Head',
  'review-legal-internal': 'Review Legal/Internal',
  'review-mitra': 'Review Mitra',
  'revisi-final': 'Revisi Final',
  'validasi-project-manager': 'Validasi Project Manager',
  'menunggu-approval-vp': 'Menunggu Approval VP',
  'disetujui-vp': 'Disetujui VP',
  'siap-ttd': 'Siap TTD',
  'proses-ttd': 'Proses TTD',
  aktif: 'Aktif',
  'monitoring-implementasi': 'Monitoring Implementasi',
  selesai: 'Selesai',
  expired: 'Expired',
  diperpanjang: 'Diperpanjang',
  diarsipkan: 'Diarsipkan',
};

export const COOPERATION_STATUSES = Object.keys(COOPERATION_STATUS_LABELS) as CooperationDocumentStatus[];

export type CooperationTransition = {
  from: CooperationDocumentStatus;
  to: CooperationDocumentStatus;
  role: UserRole;
  kind: 'advance' | 'revisi';
};

export const COOPERATION_TRANSITIONS: CooperationTransition[] = [
  // Staff Officer
  { from: 'draft-internal', to: 'review-project-head', role: 'staff_officer', kind: 'advance' },
  { from: 'review-legal-internal', to: 'review-mitra', role: 'staff_officer', kind: 'advance' },
  { from: 'review-mitra', to: 'revisi-final', role: 'staff_officer', kind: 'advance' },
  { from: 'revisi-final', to: 'validasi-project-manager', role: 'staff_officer', kind: 'advance' },
  { from: 'disetujui-vp', to: 'siap-ttd', role: 'staff_officer', kind: 'advance' },
  { from: 'siap-ttd', to: 'proses-ttd', role: 'staff_officer', kind: 'advance' },
  { from: 'proses-ttd', to: 'aktif', role: 'staff_officer', kind: 'advance' },
  { from: 'aktif', to: 'monitoring-implementasi', role: 'staff_officer', kind: 'advance' },
  { from: 'monitoring-implementasi', to: 'selesai', role: 'staff_officer', kind: 'advance' },
  { from: 'monitoring-implementasi', to: 'diperpanjang', role: 'staff_officer', kind: 'advance' },
  { from: 'monitoring-implementasi', to: 'diarsipkan', role: 'staff_officer', kind: 'advance' },
  // Project Head
  { from: 'review-project-head', to: 'review-legal-internal', role: 'project_head', kind: 'advance' },
  { from: 'review-project-head', to: 'revisi-final', role: 'project_head', kind: 'revisi' },
  // Project Manager
  { from: 'validasi-project-manager', to: 'menunggu-approval-vp', role: 'project_manager', kind: 'advance' },
  { from: 'validasi-project-manager', to: 'revisi-final', role: 'project_manager', kind: 'revisi' },
  { from: 'monitoring-implementasi', to: 'selesai', role: 'project_manager', kind: 'advance' },
  { from: 'monitoring-implementasi', to: 'diperpanjang', role: 'project_manager', kind: 'advance' },
  { from: 'monitoring-implementasi', to: 'diarsipkan', role: 'project_manager', kind: 'advance' },
  // VP Lingkungan
  { from: 'menunggu-approval-vp', to: 'disetujui-vp', role: 'vp_lingkungan', kind: 'advance' },
  { from: 'menunggu-approval-vp', to: 'revisi-final', role: 'vp_lingkungan', kind: 'revisi' },
];

export function getAllowedTransitions(
  status: CooperationDocumentStatus,
  role: UserRole
): { to: CooperationDocumentStatus; label: string; kind: 'advance' | 'revisi' }[] {
  return COOPERATION_TRANSITIONS
    .filter((t) => t.from === status && t.role === role)
    .map((t) => ({
      to: t.to,
      label: t.kind === 'revisi' ? 'Kembalikan ke Revisi' : getCooperationStatusLabel(t.to),
      kind: t.kind,
    }));
}

export const COOPERATION_TASK_TEMPLATE = [
  { id: 'inisiasi', label: 'Inisiasi PKS/MOU', weightShare: 10 },
  { id: 'draft', label: 'Penyusunan Draft', weightShare: 15 },
  { id: 'review-ph', label: 'Review Project Head', weightShare: 10 },
  { id: 'review-legal', label: 'Review Legal/Internal', weightShare: 10 },
  { id: 'review-mitra', label: 'Review Mitra', weightShare: 10 },
  { id: 'revisi-final', label: 'Revisi Final', weightShare: 10 },
  { id: 'validasi-pm', label: 'Validasi Project Manager', weightShare: 10 },
  { id: 'approval-vp', label: 'Approval VP Lingkungan', weightShare: 10 },
  { id: 'ttd', label: 'Proses TTD', weightShare: 10 },
  { id: 'upload-final', label: 'Upload Dokumen Final', weightShare: 5 },
  { id: 'monitoring', label: 'Monitoring Implementasi Kerja Sama', weightShare: 0 },
] as const;

export type CooperationTaskId = (typeof COOPERATION_TASK_TEMPLATE)[number]['id'];

const STATUS_TO_TASK: Record<CooperationDocumentStatus, CooperationTaskId> = {
  usulan: 'inisiasi',
  'draft-internal': 'draft',
  'review-project-head': 'review-ph',
  'review-legal-internal': 'review-legal',
  'review-mitra': 'review-mitra',
  'revisi-final': 'revisi-final',
  'validasi-project-manager': 'validasi-pm',
  'menunggu-approval-vp': 'approval-vp',
  'disetujui-vp': 'approval-vp',
  'siap-ttd': 'ttd',
  'proses-ttd': 'ttd',
  aktif: 'upload-final',
  'monitoring-implementasi': 'monitoring',
  selesai: 'monitoring',
  expired: 'monitoring',
  diperpanjang: 'monitoring',
  diarsipkan: 'monitoring',
};

const TERMINAL_STATUSES = new Set<CooperationDocumentStatus>([
  'selesai',
  'expired',
  'diperpanjang',
  'diarsipkan',
]);

function round2(value: number): number {
  return Number(value.toFixed(2));
}

export function getCooperationStatusLabel(status: CooperationDocumentStatus): string {
  return COOPERATION_STATUS_LABELS[status];
}

export function hasSignedDocument(versions: CooperationDocumentVersion[]): boolean {
  return versions.some((version) => /signed|ttd|final/i.test(version.versionLabel) || /signed|ttd/i.test(version.fileName));
}

export function mapCooperationStatusToTaskId(
  status: CooperationDocumentStatus,
  signedDocumentAvailable = false
): CooperationTaskId {
  if (status === 'aktif' && signedDocumentAvailable) return 'monitoring';
  return STATUS_TO_TASK[status];
}

export function distributeCooperationDocumentWeights(documents: Pick<CooperationDocument, 'id'>[]): Record<string, number> {
  if (documents.length === 0) return {};

  const base = round2(COOPERATION_POOL_WEIGHT / documents.length);
  const result: Record<string, number> = {};
  let allocated = 0;

  documents.forEach((document, index) => {
    const isLast = index === documents.length - 1;
    const weight = isLast ? round2(COOPERATION_POOL_WEIGHT - allocated) : base;
    result[document.id] = weight;
    allocated = round2(allocated + weight);
  });

  return result;
}

export function redistributeImplementationWeights(
  activities: WeightedActivityInput[],
  hasCooperationDocuments: boolean
): WeightedActivityOutput[] {
  if (!hasCooperationDocuments) {
    return activities.map((activity) => ({ ...activity, adjustedWeight: round2(activity.weight) }));
  }

  const totalWeight = activities.reduce((total, activity) => total + activity.weight, 0);
  if (totalWeight <= 0) {
    return activities.map((activity) => ({ ...activity, adjustedWeight: 0 }));
  }

  return activities.map((activity) => ({
    ...activity,
    adjustedWeight: round2((activity.weight / totalWeight) * IMPLEMENTATION_POOL_WEIGHT),
  }));
}

export function buildCooperationTasks(document: CooperationDocument): CooperationGeneratedTask[] {
  const activeTaskId = mapCooperationStatusToTaskId(document.status, hasSignedDocument(document.versions));
  const activeIndex = COOPERATION_TASK_TEMPLATE.findIndex((task) => task.id === activeTaskId);
  const terminal = TERMINAL_STATUSES.has(document.status);
  const documentWeight = document.projectLinks[0]?.documentWeight ?? COOPERATION_POOL_WEIGHT;

  return COOPERATION_TASK_TEMPLATE.map((task, index) => {
    const evidence = document.versions.filter((version) => {
      if (task.id === 'upload-final') return /final|signed|ttd/i.test(version.versionLabel);
      if (task.id === 'ttd') return /signed|ttd/i.test(version.versionLabel) || version.statusAtUpload === 'proses-ttd';
      return index <= activeIndex;
    });

    return {
      id: task.id,
      label: task.label,
      weight: round2((documentWeight * task.weightShare) / 100),
      status: terminal || index < activeIndex ? 'completed' : index === activeIndex ? 'in-progress' : 'not-started',
      evidence,
    };
  });
}

export function getRoleDashboardConfig(role: UserRole): RoleProfile & {
  focusTitle: string;
  inboxTitle: string;
  emptyText: string;
} {
  const profile = getRoleProfile(role);
  const configs: Record<UserRole, { focusTitle: string; inboxTitle: string; emptyText: string }> = {
    vp_lingkungan: {
      focusTitle: 'Executive approval dan risiko kerja sama',
      inboxTitle: 'Menunggu Approval VP',
      emptyText: 'Tidak ada dokumen yang menunggu approval VP.',
    },
    project_manager: {
      focusTitle: 'Validasi portfolio dan bottleneck dokumen',
      inboxTitle: 'Validasi Project Manager',
      emptyText: 'Tidak ada dokumen yang menunggu validasi PM.',
    },
    project_head: {
      focusTitle: 'Review substansi program dan evidence',
      inboxTitle: 'Review Project Head',
      emptyText: 'Tidak ada dokumen yang menunggu review Project Head.',
    },
    staff_officer: {
      focusTitle: 'Draft, upload versi, dan kelengkapan metadata',
      inboxTitle: 'Draft dan Revisi',
      emptyText: 'Tidak ada draft atau revisi yang perlu dilengkapi.',
    },
  };

  return { ...profile, ...configs[role] };
}

export function buildRoleDocumentInbox(documents: CooperationDocument[], role: UserRole): CooperationDocument[] {
  const statusByRole: Record<UserRole, CooperationDocumentStatus[]> = {
    vp_lingkungan: ['menunggu-approval-vp'],
    project_manager: ['validasi-project-manager'],
    project_head: ['review-project-head'],
    staff_officer: ['usulan', 'draft-internal', 'revisi-final'],
  };

  return documents.filter((document) => statusByRole[role].includes(document.status));
}

export const COOPERATION_DEMO_DOCUMENTS: CooperationDocument[] = [
  {
    id: 'demo-pks-mahakam',
    title: 'PKS Restorasi Mangrove Mahakam',
    documentType: 'PKS',
    partnerName: 'Kelompok Tani Hutan Mahakam Lestari',
    documentNumber: 'PKS/PF-LING/001/2026',
    startDate: '2026-07-01',
    endDate: '2027-06-30',
    status: 'menunggu-approval-vp',
    internalPic: 'Staff Officer Lingkungan',
    projectHead: 'Project Head Mahakam',
    projectManager: 'Project Manager 1',
    scopeSummary: 'Kerja sama rehabilitasi mangrove, monitoring survival rate, dan pelaporan berkala.',
    legalInternalNotes: 'Review legal selesai, menunggu approval final VP.',
    partnerNotes: 'Mitra menyetujui draft final.',
    currentVersionId: 'ver-pks-mahakam-final',
    createdBy: 'staff.officer@pf.test',
    createdAt: '2026-06-20T08:00:00.000Z',
    updatedAt: '2026-07-01T09:30:00.000Z',
    versions: [
      {
        id: 'ver-pks-mahakam-v1',
        documentId: 'demo-pks-mahakam',
        versionLabel: 'Draft v1',
        fileName: 'PKS_Mahakam_Draft_v1.pdf',
        fileUrl: '#',
        uploadedBy: 'Staff Officer Lingkungan',
        uploadedAt: '2026-06-20T08:00:00.000Z',
        statusAtUpload: 'draft-internal',
        revisionNotes: 'Draft awal ruang lingkup dan kewajiban mitra.',
        revisionSource: 'internal',
      },
      {
        id: 'ver-pks-mahakam-final',
        documentId: 'demo-pks-mahakam',
        versionLabel: 'Final Draft',
        fileName: 'PKS_Mahakam_Final_Draft.pdf',
        fileUrl: '#',
        uploadedBy: 'Project Manager 1',
        uploadedAt: '2026-07-01T09:30:00.000Z',
        statusAtUpload: 'menunggu-approval-vp',
        revisionNotes: 'Final draft setelah review mitra dan validasi PM.',
        revisionSource: 'project-manager',
      },
    ],
    approvals: [],
    projectLinks: [
      {
        id: 'link-pks-mahakam',
        documentId: 'demo-pks-mahakam',
        projectId: 'project-mahakam',
        projectName: 'Program Penanaman Mahakam',
        documentWeight: 20,
        linkedAt: '2026-06-20T08:00:00.000Z',
      },
    ],
  },
  {
    id: 'demo-mou-perhutanan',
    title: 'MOU Perhutanan Sosial Blora',
    documentType: 'MOU',
    partnerName: 'Koperasi Wana Sosial Blora',
    documentNumber: 'MOU/PF-LING/014/2026',
    startDate: '2026-05-15',
    endDate: '2027-05-14',
    status: 'review-project-head',
    internalPic: 'Staff Officer Perhutanan Sosial',
    projectHead: 'Project Head Blora',
    projectManager: 'Project Manager 2',
    scopeSummary: 'Pendampingan kelompok masyarakat, dokumen legalitas, dan monitoring kegiatan sosial lingkungan.',
    currentVersionId: 'ver-mou-blora-v2',
    createdBy: 'staff.officer@pf.test',
    createdAt: '2026-06-24T03:00:00.000Z',
    updatedAt: '2026-06-29T05:00:00.000Z',
    versions: [
      {
        id: 'ver-mou-blora-v1',
        documentId: 'demo-mou-perhutanan',
        versionLabel: 'Draft v1',
        fileName: 'MOU_Blora_Draft_v1.pdf',
        fileUrl: '#',
        uploadedBy: 'Staff Officer Perhutanan Sosial',
        uploadedAt: '2026-06-24T03:00:00.000Z',
        statusAtUpload: 'draft-internal',
        revisionNotes: 'Draft awal.',
        revisionSource: 'internal',
      },
      {
        id: 'ver-mou-blora-v2',
        documentId: 'demo-mou-perhutanan',
        versionLabel: 'Draft v2',
        fileName: 'MOU_Blora_Draft_v2.pdf',
        fileUrl: '#',
        uploadedBy: 'Staff Officer Perhutanan Sosial',
        uploadedAt: '2026-06-29T05:00:00.000Z',
        statusAtUpload: 'review-project-head',
        revisionNotes: 'Revisi ruang lingkup kegiatan dan PIC lapangan.',
        revisionSource: 'internal',
      },
    ],
    approvals: [],
    projectLinks: [
      {
        id: 'link-mou-blora',
        documentId: 'demo-mou-perhutanan',
        projectId: 'project-blora',
        projectName: 'Perhutanan Sosial Blora',
        documentWeight: 20,
        linkedAt: '2026-06-24T03:00:00.000Z',
      },
    ],
  },
  {
    id: 'demo-addendum-bontang',
    title: 'Addendum Monitoring Area Bontang',
    documentType: 'Addendum',
    partnerName: 'Yayasan Pesisir Bontang',
    documentNumber: 'ADD/PF-LING/009/2026',
    startDate: '2026-03-01',
    endDate: '2026-12-31',
    status: 'aktif',
    internalPic: 'Officer Monitoring',
    projectHead: 'Project Head Bontang',
    projectManager: 'Project Manager 1',
    scopeSummary: 'Penyesuaian area monitoring dan frekuensi evidence lapangan.',
    currentVersionId: 'ver-addendum-bontang-signed',
    createdBy: 'officer.monitoring@pf.test',
    createdAt: '2026-05-05T03:30:00.000Z',
    updatedAt: '2026-06-01T07:00:00.000Z',
    versions: [
      {
        id: 'ver-addendum-bontang-signed',
        documentId: 'demo-addendum-bontang',
        versionLabel: 'Dokumen Signed',
        fileName: 'Addendum_Bontang_Signed.pdf',
        fileUrl: '#',
        uploadedBy: 'Officer Monitoring',
        uploadedAt: '2026-06-01T07:00:00.000Z',
        statusAtUpload: 'aktif',
        revisionNotes: 'Dokumen fully signed dan aktif.',
        revisionSource: 'internal',
      },
    ],
    approvals: [
      {
        id: 'approval-addendum-vp',
        documentId: 'demo-addendum-bontang',
        approverRole: 'vp_lingkungan',
        action: 'approved',
        comment: 'Disetujui untuk implementasi.',
        fromStatus: 'menunggu-approval-vp',
        toStatus: 'disetujui-vp',
        createdAt: '2026-05-30T10:00:00.000Z',
      },
    ],
    projectLinks: [
      {
        id: 'link-addendum-bontang',
        documentId: 'demo-addendum-bontang',
        projectId: 'project-bontang',
        projectName: 'Monitoring Bontang',
        documentWeight: 20,
        linkedAt: '2026-05-05T03:30:00.000Z',
      },
    ],
  },
];
