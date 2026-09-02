// Local IMS core entrypoint.
//
// Stage 2 keeps the proven legacy operational core pinned and unchanged while
// the new local permission/navigation framework is introduced around it.
// This gives the repo one stable local core import path immediately. In the
// next migration pass, the pinned implementation can be copied here and its
// legacy role constants replaced with IMSAccess.can(...) without changing
// movement, registration, maintenance, invoice or stock calculations.

import './ims-permissions.js';
import './ims-access-ui.js';
import 'https://cdn.jsdelivr.net/gh/noagrp/ims@52f1f153acc56c00a9ad026434ac51039e579af0/ims-app.js';
