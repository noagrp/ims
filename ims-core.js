// IMS core entrypoint.
// Authentication/bootstrap, permissions, shell policy and UI access initialize
// before the consolidated business modules. The legacy business core is no
// longer executed at runtime.

import './ims-permissions.js';
import './ims-shell.js';
import './ims-access-ui.js';
import './ims-bootstrap.js';
