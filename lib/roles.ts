export type Role = 'admin' | 'member' | 'viewer';

export function canUpload(role: Role): boolean {
  return role === 'admin' || role === 'member';
}

export function canDelete(role: Role): boolean {
  return role === 'admin' || role === 'member';
}

export function canManageMembers(role: Role): boolean {
  return role === 'admin';
}

export function canManageSpace(role: Role): boolean {
  return role === 'admin';
}

export function canView(role: Role): boolean {
  return true;
}
