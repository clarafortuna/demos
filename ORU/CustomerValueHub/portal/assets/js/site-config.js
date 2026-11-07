/* ============================================================================
   O&R portal: name and editable copy, in one place.

   NAME: the working name is "O&R Customer Value Hub". The final name comes
   from the internal naming contest; change `name` below and every page
   (header, footer, browser tab, Admin Portal) picks it up.

   COPY: the homepage text that Corporate Affairs will refine. Each entry is
   matched to an element carrying data-copy="<key>". Edit the text here; the
   HTML keeps the same wording as a fallback. Plain text only.
   ============================================================================ */
window.ORU_SITE = {
  name: 'O&R Customer Value Hub',
  tagline: 'Unified Innovation Portal',

  copy: {
    /* Hero */
    'home.hero.eyebrow': 'Innovation at O&R',
    'home.hero.line1': 'HUMAN',
    'home.hero.line2': 'INGENUITY',
    'home.hero.line3': 'AMPLIFIED',
    'home.hero.intro': 'Every day, our teams find better ways to serve our customers and communities. Technology gives them better tools to do it, and innovation still starts with them.',

    /* Welcome video, under the hero */

    /* Band under the hero photo */
    'home.band.1.title': 'People First',
    'home.band.1.text': 'Technology supports the knowledge and judgement of our teams.',
    'home.band.2.title': 'Real Challenges',
    'home.band.2.text': 'Innovation starts with the everyday work our people know best.',
    'home.band.3.title': 'Shared Ideas',
    'home.band.3.text': 'Every employee can suggest a better way to work and serve our customers.',

    /* Our story */
    'home.story.label': 'Our Story',
    'home.story.title': 'How we put technology to work.',
    'home.story.text': 'At Orange & Rockland, technology is a means, not an end. The meters in the field, the systems in the control room and the tools on every desk exist for one reason: to help our people deliver value to our customers. The best ideas come from the challenges our teams see every day.',
    'home.story.1.title': 'More Time for Customers',
    'home.story.1.text': 'Simplify repetitive work so teams can spend their time where it counts.',
    'home.story.2.title': 'Clearer Answers, Faster',
    'home.story.2.text': 'Make information easier to find, so decisions rest on the facts.',
    'home.story.3.title': 'Better Experiences',
    'home.story.3.text': 'Find smarter ways to support employees, customers and communities.',

    /* Initiatives teaser */
    'home.initiatives.label': 'Innovation in Action',
    'home.initiatives.title': 'Innovation is already taking shape.',
    'home.initiatives.intro': 'Across Orange & Rockland, teams are finding smarter ways to take on real business challenges. Discover some of the initiatives helping shape what’s next.',

    /* Share an idea */
    'home.share.title': 'What if your idea is the next big thing?',
    'home.share.intro': 'You know your work better than anyone. Whether it’s a repetitive task, a difficult process, or an opportunity to do something differently, your perspective could inspire the next innovation at O&R. No technical expertise required. Just an idea.',

    /* Footer, every page */
    'footer.about': 'A place for employees across O&R to discover initiatives, explore new possibilities, and share ideas that create value for our customers.'
  }
};

/* Applies the name and the copy. Runs at the end of <body>, before the page
   animations split the headings into words. */
(function () {
  var site = window.ORU_SITE;
  if (!site || !document.querySelectorAll) return;
  [].forEach.call(document.querySelectorAll('[data-site]'), function (el) {
    var v = site[el.getAttribute('data-site')];
    if (typeof v === 'string') el.textContent = v;
  });
  [].forEach.call(document.querySelectorAll('[data-copy]'), function (el) {
    var v = site.copy && site.copy[el.getAttribute('data-copy')];
    if (typeof v === 'string') el.textContent = v;
  });
  var page = document.documentElement.getAttribute('data-site-page');
  document.title = (page ? page + ' | ' : '') + site.name;
})();

/* User or Admin: who the portal is shown to. Users see the public pages and
   Intake Requests, where they raise requests and follow their own. Admins
   also see the Admin Portal: the register, the reporting desk and managing
   requests. The switch sits in the site header on every page and is kept in
   this browser. It decides what is shown, not who may see it: real
   permissions come with sign-in roles. Pages react to the `oru-role` event. */
(function () {
  var KEY = 'oru.role';
  function get() {
    try { return localStorage.getItem(KEY) === 'admin' ? 'admin' : 'user'; } catch (e) { return 'user'; }
  }
  // Links into the admin side: the Admin Portal and its deep links, on the
  // site pages (portal.html#...) and in the portal's own header (#exec).
  // Intake and Propose a Use Case are for everyone.
  var ADMIN_LINKS = 'a[href^="portal.html"]:not([href$="#intake"]):not([href$="#usecase"]), .sn-portal, a.sn-portal';

  function apply() {
    var role = get();
    document.documentElement.setAttribute('data-oru-role', role);
    [].forEach.call(document.querySelectorAll(ADMIN_LINKS), function (a) {
      var item = a.closest('li') || a;
      item.style.display = role === 'admin' ? '' : 'none';
    });
    [].forEach.call(document.querySelectorAll('.oru-role button'), function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-role') === role));
    });
  }
  function set(role) {
    try { localStorage.setItem(KEY, role === 'admin' ? 'admin' : 'user'); } catch (e) {}
    apply();
    var ev;
    try { ev = new CustomEvent('oru-role', { detail: get() }); }
    catch (e) { ev = document.createEvent('CustomEvent'); ev.initCustomEvent('oru-role', false, false, get()); }
    window.dispatchEvent(ev);
  }

  var CSS = '.oru-role{display:inline-flex;flex:none;padding:3px;border-radius:999px;background:rgba(0,0,0,.06);gap:2px}' +
    '.oru-role button{border:0;background:transparent;color:inherit;font:inherit;font-size:13px;font-weight:600;line-height:1;' +
    'padding:8px 14px;border-radius:999px;cursor:pointer;opacity:.7}' +
    '.oru-role button[aria-pressed="true"]{background:var(--primary-color,#c24e17);color:#fff;opacity:1}' +
    '.oru-role button:focus-visible{outline:2px solid var(--primary-color,#c24e17);outline-offset:2px}' +
    '.mobile-menu-modal-main-body .oru-role,.sn-mob .oru-role{margin:18px 0 0;align-self:flex-start}' +
    // The portal's own header has no room on a phone; its menu carries the switch.
    '@media (max-width:640px){.sn-in>.oru-role{display:none}}';
  function control() {
    var box = document.createElement('div');
    box.className = 'oru-role';
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', 'View the portal as');
    box.innerHTML = '<button type="button" data-role="user">User</button><button type="button" data-role="admin">Admin</button>';
    box.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-role]');
      if (b) set(b.getAttribute('data-role'));
    });
    return box;
  }

  window.ORU_ROLE = { get: get, set: set, apply: apply };

  // Pages that are not the site (the welcome video) carry no header.
  if (!document.querySelector('.header-main, .sn-in')) return;
  var style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  // Desktop header, beside the menu; and the mobile menu.
  var header = document.querySelector('.header-main, .sn-in');
  var burger = header.querySelector('.mobile-menu-offcanvas-toggler, .sn-burger');
  header.insertBefore(control(), burger);
  var mobile = document.querySelector('.mobile-menu-modal-main-body, .sn-mob');
  if (mobile) mobile.appendChild(control());
  apply();
})();
