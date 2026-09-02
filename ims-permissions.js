// IMS central role + permission registry.
// This file defines UI capability intent only. Firestore Security Rules remain
// the final authority for data access and must be kept aligned with this map.

const ROLES = Object.freeze({
  ADMIN: 'admin',
  MANAGER: 'manager',
  SUPERADMIN: 'superadmin'
});

const ALL = Object.freeze([ROLES.ADMIN, ROLES.MANAGER, ROLES.SUPERADMIN]);
const MANAGER_UP = Object.freeze([ROLES.MANAGER, ROLES.SUPERADMIN]);
const SUPER_ONLY = Object.freeze([ROLES.SUPERADMIN]);

const PERMISSIONS = Object.freeze({
  // Core application
  'app.view': ALL,

  // Inventory / registration
  'inventory.view': ALL,
  'inventory.add': ALL,
  'inventory.edit': MANAGER_UP,
  'inventory.alias.edit': ALL,
  'inventory.delete': SUPER_ONLY,
  'inventory.export.csv': ALL,
  'inventory.print.pdf': ALL,

  // Operational workflows
  'movement.view': ALL,
  'movement.add': ALL,
  'movement.edit': ALL,
  'movement.delete': SUPER_ONLY,
  'maintenance.view': ALL,
  'maintenance.add': ALL,
  'maintenance.edit': ALL,
  'maintenance.delete': SUPER_ONLY,

  // Document references
  'documents.view': ALL,
  'documents.add': ALL,
  'documents.edit': MANAGER_UP,
  'documents.delete': SUPER_ONLY,

  // Master data
  'masters.view': ALL,
  'masters.add': MANAGER_UP,
  'masters.edit': MANAGER_UP,
  'masters.status': MANAGER_UP,
  'masters.delete': SUPER_ONLY,

  // Supplier / client business masters
  'supplier.view': ALL,
  'supplier.add': ALL,
  'supplier.edit': ALL,
  'supplier.status': MANAGER_UP,
  'supplier.delete': SUPER_ONLY,
  'client.view': ALL,
  'client.add': ALL,
  'client.edit': ALL,
  'client.status': MANAGER_UP,
  'client.delete': SUPER_ONLY,

  // Audit
  'audit.view': MANAGER_UP,
  'audit.export.csv': MANAGER_UP,
  'audit.print.pdf': MANAGER_UP,

  // User management
  'users.view': MANAGER_UP,
  'users.add': MANAGER_UP,
  'users.edit': MANAGER_UP,
  'users.status': MANAGER_UP,
  'users.role.edit': SUPER_ONLY,
  'users.delete': SUPER_ONLY,

  // Backup / restore
  'backup.create': SUPER_ONLY,
  'backup.restore': SUPER_ONLY,
  'system.test.reset': SUPER_ONLY,

  // General output actions
  'records.export.csv': ALL,
  'records.print.pdf': ALL
});

const NAVIGATION = Object.freeze([
  { id: 'workspace', label: 'Main Workspace', permission: 'app.view' },
  { id: 'logs', label: 'Logs / Records', permission: 'app.view' },
  { id: 'suppliers', label: 'Suppliers', permission: 'supplier.view' },
  { id: 'clients', label: 'Clients', permission: 'client.view' },
  { id: 'settings', label: 'Global Settings', permission: 'masters.view' },
  { id: 'audit', label: 'Audit / Trace', permission: 'audit.view' },
  { id: 'users', label: 'User Management', permission: 'users.view' }
]);

function currentRole() {
  return String(window.IMS_ROLE || '').trim().toLowerCase();
}

function can(permission, role = currentRole()) {
  const allowed = PERMISSIONS[permission];
  return Array.isArray(allowed) && allowed.includes(role);
}

function canAny(...permissions) {
  return permissions.some(permission => can(permission));
}

function canAll(...permissions) {
  return permissions.every(permission => can(permission));
}

window.IMSAccess = Object.freeze({
  ROLES,
  PERMISSIONS,
  NAVIGATION,
  currentRole,
  can,
  canAny,
  canAll
});

export { ROLES, PERMISSIONS, NAVIGATION, currentRole, can, canAny, canAll };
