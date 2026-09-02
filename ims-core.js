// Local IMS core entrypoint.
// Central permissions, shell/navigation, and UI access are initialized before
// the proven legacy operational core. The legacy core remains local to this
// repository and operational business logic is unchanged in this stage.

import './ims-permissions.js';
import './ims-shell.js';
import './ims-access-ui.js';
import './ims-legacy-core.js';
