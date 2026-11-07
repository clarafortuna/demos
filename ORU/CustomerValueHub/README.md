# O&R Customer Value Hub

The O&R portal (working name in `portal/assets/js/site-config.js`), and the
project that publishes it as a Power Apps code app with Dataverse and email
notifications.

| Folder | What it is |
|---|---|
| `portal/` | The site: Home, Initiatives, Training, Share an Idea, and the Admin Portal (`portal.html`). Plain HTML, CSS and JS; runs from any static server with sample data. |
| `powerapp/` | Builds `portal/` for the Power Apps host and pushes it. Dataverse access, the tables, the email flows and their scripts. See `powerapp/README.md`. |

Run the site locally (sample data, nothing saved):

    cd portal && python -m http.server 5181
    # open http://localhost:5181/index.html

Publish to Power Apps (Clara Fortuna Dev, solution "Customer Value Hub"):

    cd powerapp && npm install && node build/powerapp_build.js
    pac code push --solutionName CustomerValueHub

Inside Power Apps the portal saves to Dataverse (`ptrl_request`,
`ptrl_attachment`, `ptrl_idea`, `ptrl_usecase`) and four flows send the emails.
