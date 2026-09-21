export const babyDeletionEn = {
  "babyProfile.deleteBaby.action": "Delete baby",
  "babyProfile.deleteBaby.title": "Delete {babyName}'s profile?",
  "babyProfile.deleteBaby.body": "This permanently removes this baby's records and shared access. Photos and other files are queued for deletion. This cannot be undone.",
  "babyProfile.deleteBaby.confirm": "Delete baby",
  "babyProfile.deleteBaby.error": "Could not delete this baby. Check your access and try again.",
} as const;

export const babyDeletionKo: Record<keyof typeof babyDeletionEn, string> = {
  "babyProfile.deleteBaby.action": "아기 삭제",
  "babyProfile.deleteBaby.title": "{babyName}의 프로필을 삭제할까요?",
  "babyProfile.deleteBaby.body": "이 아기의 기록과 공유 접근 권한이 영구적으로 삭제됩니다. 사진과 파일도 삭제 대기열에 등록됩니다. 되돌릴 수 없어요.",
  "babyProfile.deleteBaby.confirm": "아기 삭제",
  "babyProfile.deleteBaby.error": "아기를 삭제하지 못했어요. 권한을 확인하고 다시 시도해 주세요.",
};

export const babyDeletionJa: Record<keyof typeof babyDeletionEn, string> = {
  "babyProfile.deleteBaby.action": "赤ちゃんを削除",
  "babyProfile.deleteBaby.title": "{babyName}のプロフィールを削除しますか？",
  "babyProfile.deleteBaby.body": "この赤ちゃんの記録と共有アクセスは完全に削除されます。写真とファイルも削除待ちになります。元に戻せません。",
  "babyProfile.deleteBaby.confirm": "赤ちゃんを削除",
  "babyProfile.deleteBaby.error": "削除できませんでした。アクセス権を確認して、もう一度お試しください。",
};

export const babyDeletionEs: Record<keyof typeof babyDeletionEn, string> = {
  "babyProfile.deleteBaby.action": "Eliminar bebé",
  "babyProfile.deleteBaby.title": "¿Eliminar el perfil de {babyName}?",
  "babyProfile.deleteBaby.body": "Se eliminarán permanentemente sus registros y el acceso compartido. Las fotos y los archivos quedarán pendientes de eliminación. No se puede deshacer.",
  "babyProfile.deleteBaby.confirm": "Eliminar bebé",
  "babyProfile.deleteBaby.error": "No se pudo eliminar el bebé. Comprueba tu acceso e inténtalo de nuevo.",
};

export const babyDeletionZhCN: Record<keyof typeof babyDeletionEn, string> = {
  "babyProfile.deleteBaby.action": "删除宝宝",
  "babyProfile.deleteBaby.title": "要删除{babyName}的资料吗？",
  "babyProfile.deleteBaby.body": "此宝宝的记录和共享访问权限将永久删除。照片和文件也会进入删除队列。此操作无法撤销。",
  "babyProfile.deleteBaby.confirm": "删除宝宝",
  "babyProfile.deleteBaby.error": "无法删除宝宝。请检查访问权限后重试。",
};
