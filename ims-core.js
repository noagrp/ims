// Local IMS core entrypoint.
// Central permissions and UI access are initialized before the proven legacy
// operational core. The legacy core is now vendored in this repository, so IMS
// no longer depends on a pinned CDN copy at runtime.

import './ims-permissions.js';
import './ims-access-ui.js';
import './ims-legacy-core.js';
