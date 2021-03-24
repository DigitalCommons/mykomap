// This module returns an object with a boolean property 'enabled' that is true iff debugging is on.

// Implementation: If we are running code that has not been build by r.js (e.g. from the source in directory 'www')
// then the value of 'debug' is determined by the code below, IGNORING COMMENTS.
// But if r.js has built the code (e.g. the source in directory 'www-built') then the special comments below
// determine which code is executed.

"use strict";
module.exports = { enabled: true };
