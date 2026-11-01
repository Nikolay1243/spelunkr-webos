# Provenance — v0.3.7

The application bundles the public production website client from https://spelunkr.tv. Its source repository has not been located. The exact entry points, retrieval metadata, and SHA-256 hashes are tracked in `upstream/site-manifest.json`. Website assets are downloaded locally by `npm run sync:site`, excluded from Git, and included in the built IPK.

The build bundles the original modules and styles and applies checked adaptations for packaged navigation, TV controls, playback geometry, and authentication. Website resources and live services continue to use upstream servers. Original client code, branding, artwork, fonts, styling, and programming retain their respective ownership and rights. No independent license for upstream materials is asserted.

The Android project https://github.com/ominixisboss/Spelunkr.tv-App was inspected as a reference. No Android code or artwork is included, and this repository is not a fork. An earlier discarded prototype used https://github.com/buddytohelpu/spelunkr-guide to understand broadcast data; that prototype and its fixtures are excluded from this repository and build.

The webOS adapter, build scripts, tests, and authentication service were developed for this project. The authentication service bundles `ws` 8.22.1; its MIT license is retained in `service/ws-LICENSE.txt`. It uses the TV-provided `webos-service` runtime.

Physical development validation on webOS 9.2.2 covered installation, playback, 4:3 pillarboxing, original guide layout, Magic Remote channel keys, guide paging without retuning, menu/Back behavior, two-second Spelunk hold and cancellation, fullscreen transitions without video reload, and Discord login persistence. The authentication flow requires the local app-debugging endpoint described in the README. Automated tests cover the adapter’s policies and state transitions. Other TV models and older webOS versions have not been validated.
