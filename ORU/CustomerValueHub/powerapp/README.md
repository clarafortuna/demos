# O&R portal — Power Apps code app

The portal in `Downloads/ORU_AI_Portal_Expart` is published as the Power Apps
code app `0a0c6fa7-a7ff-4976-b967-dbec9ad797b2` (Clara Fortuna Dev).

Publish after editing the portal:

    node build/powerapp_build.js
    pac code push

`build/powerapp_build.js` copies the portal into `dist/` and adapts it to the
Power Apps host:

- The host serves text files intact but corrupts binary ones, so images are
  embedded as data URIs and no binary file goes into `dist/`.
- The host's CSP allows fonts only from 'self' and blocks Google Fonts, so all
  fonts (icon fonts and Outfit/Inter/Plus Jakarta Sans from `build/fontcache`)
  are registered from bytes by `assets/js/pa-fonts.js`.
- The player keeps the app hidden until the app opens its message channel.
  `host/host.js` (bundled to `assets/js/pa-host.js`) does that on every page
  and gives the pages `window.PortalHost` for Dataverse.

The CSP also sets `connect-src 'none'` and `form-action 'none'`: pages cannot
call external services or submit forms to a server from inside Power Apps.

## Dataverse and email (solution "Customer Value Hub", prefix `ptrl`)

- `ptrl_request`: intake requests, same shape as `R()` in portal.html (78 tracker
  rows seeded by `dataverse/seed.js`). The Admin Portal reads and writes it.
- `ptrl_attachment`: files attached to a request (File column `ptrl_file`, up to
  32 MB each), keyed by `ptrl_requestkey`. Uploaded after the request is saved,
  listed and downloaded from the request drawer.
- `ptrl_usecase`: use cases proposed in "Propose a Use Case", the five step,
  forty question Customer Operations intake (field list from Mario, 2026-11-04).
  Answers are kept in `ptrl_answers` (JSON) in the original form's wording; the
  Use Case Pipeline exports them in the original order.
- `ptrl_idea`: Share an Idea submissions.
- Flows: "Customer Value Hub - New request emails", "- Request stage emails",
  "- New idea emails" (`dataverse/portal-flows.js`; `node portal-flows.js preview`
  writes an HTML preview). Only @clarafortuna.com addresses receive mail; anything
  else goes to gerald@clarafortuna.com while the portal is confidential.
- The email button opens the app with `&request=REQ-123`, which opens that request.

Scripts in `dataverse/` sign in with `node auth.js` (device code) and keep the
token in `dataverse/token.json`; delete it when done. After creating or
changing a flow, turn it off and on once so its Dataverse trigger fires.
