// IMS central role + permission registry.
// UI capability intent only. Firestore Security Rules remain the final authority.
const ROLES=Object.freeze({ADMIN:'admin',MANAGER:'manager',SUPERADMIN:'superadmin'});
const ALL=Object.freeze([ROLES.ADMIN,ROLES.MANAGER,ROLES.SUPERADMIN]);
const MANAGER_UP=Object.freeze([ROLES.MANAGER,ROLES.SUPERADMIN]);
const SUPER_ONLY=Object.freeze([ROLES.SUPERADMIN]);
const PERMISSIONS=Object.freeze({
'app.view':ALL,
'inventory.view':ALL,'inventory.add':ALL,'inventory.edit':MANAGER_UP,'inventory.alias.edit':ALL,'inventory.delete':SUPER_ONLY,'inventory.export.csv':ALL,'inventory.print.pdf':ALL,
'movement.view':ALL,'movement.add':ALL,'movement.edit':ALL,'movement.delete':SUPER_ONLY,
'servicecycle.view':ALL,'servicecycle.add':ALL,'servicecycle.edit':ALL,'servicecycle.delete':SUPER_ONLY,
'invoice.view':ALL,'invoice.export.csv':ALL,'invoice.print.pdf':ALL,'invoice.cancel':ALL,
'documents.view':ALL,'documents.add':ALL,'documents.edit':MANAGER_UP,'documents.delete':SUPER_ONLY,
'reservation.view':ALL,'reservation.add':ALL,'reservation.edit':ALL,'reservation.cancel':ALL,
'disposition.view':ALL,'disposition.add':MANAGER_UP,'disposition.edit':MANAGER_UP,
'incident.view':ALL,'incident.add':ALL,'incident.edit':ALL,
'renttorent.view':ALL,'renttorent.add':ALL,'renttorent.edit':ALL,
'masters.view':ALL,'masters.add':MANAGER_UP,'masters.edit':MANAGER_UP,'masters.status':MANAGER_UP,'masters.delete':SUPER_ONLY,
'supplier.view':ALL,'supplier.add':ALL,'supplier.edit':ALL,'supplier.status':MANAGER_UP,'supplier.delete':SUPER_ONLY,
'client.view':ALL,'client.add':ALL,'client.edit':ALL,'client.status':MANAGER_UP,'client.delete':SUPER_ONLY,
'records.view':ALL,'records.export.csv':ALL,'records.print.pdf':ALL,
'audit.view':MANAGER_UP,'audit.export.csv':MANAGER_UP,'audit.print.pdf':MANAGER_UP,
'users.view':MANAGER_UP,'users.add':MANAGER_UP,'users.edit':MANAGER_UP,'users.status':MANAGER_UP,'users.role.edit':SUPER_ONLY,'users.delete':SUPER_ONLY,
'backup.create':SUPER_ONLY,'backup.restore':SUPER_ONLY,'system.test.reset':SUPER_ONLY
});
const NAVIGATION=Object.freeze([
{id:'workspace',label:'Main Workspace',permission:'app.view'},
{id:'stock',label:'Stock Inventory',permission:'inventory.view'},
{id:'invoices',label:'Documents',permission:'documents.view'},
{id:'renttorent',label:'Rent-to-Rent',permission:'renttorent.view'},
{id:'reservation',label:'Reservation',permission:'reservation.view'},
{id:'disposition',label:'Disposition',permission:'disposition.view'},
{id:'incident',label:'Incident',permission:'incident.view'},
{id:'logs',label:'Logs / Records',permission:'records.view'},
{id:'suppliers',label:'Suppliers',permission:'supplier.view'},
{id:'clients',label:'Clients',permission:'client.view'},
{id:'settings',label:'Global Settings',permission:'masters.view'},
{id:'audit',label:'Audit / Trace',permission:'audit.view'},
{id:'users',label:'User Management',permission:'users.view'}
]);
function currentRole(){return String(window.IMS_ROLE||'').trim().toLowerCase();}
function can(permission,role=currentRole()){const allowed=PERMISSIONS[permission];return Array.isArray(allowed)&&allowed.includes(role);}
function canAny(...permissions){return permissions.some(permission=>can(permission));}
function canAll(...permissions){return permissions.every(permission=>can(permission));}
window.IMSAccess=Object.freeze({ROLES,PERMISSIONS,NAVIGATION,currentRole,can,canAny,canAll});
export {ROLES,PERMISSIONS,NAVIGATION,currentRole,can,canAny,canAll};