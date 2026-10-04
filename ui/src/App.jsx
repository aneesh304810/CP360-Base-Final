import React, { useState, useEffect } from "react";
import AppShell from "./AppShell.jsx";
import { tLight } from "./bbhTheme.js";
import { probeApi, isLive } from "./api.js";
import LandingPage from "./LandingPage.jsx";
import SystemDesign from "./SystemDesign.jsx";
import Interface360 from "./Interface360.jsx";
import Api360 from "./Api360.jsx";
import Data360 from "./Data360.jsx";
import Datapoint360 from "./Datapoint360.jsx";
import SearchResults from "./SearchResults.jsx";
import PiiExplorer from "./PiiExplorer.jsx";
import Guardrails from "./Guardrails.jsx";
import DevOps360 from "./DevOps360.jsx";
import LineageHome from "./LineageHome.jsx";
import Event360 from "./Event360.jsx";
import ImpactAnalysis from "./ImpactAnalysis.jsx";
import Mapper from "./Mapper.jsx";
import Variance360 from "./Variance360.jsx";
import AdminDatasources from "./AdminDatasources.jsx";
import Recon360 from "./Recon360.jsx";
import Api360Console, { ApiCatalogAdmin } from "./Api360Console.jsx";
import Environment360 from "./Environment360.jsx";
import HubDesign from "./HubDesign.jsx";
import Integration360Design from "./Integration360Design.jsx";
import SecurityAdmin from "./SecurityAdmin.jsx";
import Compare from "./Compare.jsx";
import Login from "./Login.jsx";
import { securityApi, allowed } from "./securityApi.js";

function currentRoute() {
 const h = (window.location.hash || "#home").replace(/^#/, "");
 return h.split("?")[0] || "home";
}

export default function App() {
 const t = tLight;
 const [route, setRoute] = useState(currentRoute());
 const [live, setLive] = useState(false);
 const [selection, setSelection] = useState(null); // deep-link target from search
 // undefined = not asked yet. Rendering anything before /auth/me answers
 // would flash the whole app at somebody who is about to be shown a login
 // screen, which is both ugly and a hint about what exists behind it.
 const [me, setMe] = useState(undefined);

 useEffect(() => {
 securityApi.me().then(setMe);
 probeApi().then(() => setLive(isLive()));
 const onHash = () => setRoute(currentRoute());
 window.addEventListener("hashchange", onHash);
 return () => window.removeEventListener("hashchange", onHash);
 }, []);

 const nav = (r) => {
 // preserve any project param already in the hash query
 const q = (window.location.hash.split("?")[1] || "");
 window.location.hash = q ? `${r}?${q}` : r;
 setRoute(r);
 };

 // navigate from a search result straight to the item in its module
 const navTo = (target) => {
 if (!target) return;
 setSelection(target); // {module, tab, id, ...}
 nav(target.module);
 };

 const screens = {
 home: <LandingPage t={t} onNav={nav} />,
 system: <SystemDesign t={t} onNav={nav} />,
 search: <SearchResults t={t} onOpen={navTo} />,
 interface: <Interface360 t={t} selection={route === "interface" ? selection : null} />,
 api: <Api360 t={t} selection={route === "api" ? selection : null} />,
 data: <Data360 t={t} selection={route === "data" ? selection : null} />,
 datapoint: <Datapoint360 t={t} selection={route === "datapoint" ? selection : null} onOpen={navTo} />,
 pii: <PiiExplorer t={t} selection={route === "pii" ? selection : null} />,
 guardrails: <Guardrails t={t} selection={route === "guardrails" ? selection : null} />,
 devops360: <DevOps360 t={t} />,
 variance: <Variance360 t={t} />,
 datasources: <AdminDatasources t={t} />,
 recon: <Recon360 t={t} />,
 apiconsole: <Api360Console t={t} />,
 apicatalog: <ApiCatalogAdmin t={t} />,
 lineage: <LineageHome t={t} focus={route === "lineage" ? selection : null} />,
 event360: <Event360 t={t} />,
 impact: <ImpactAnalysis t={t} />,
 mapper: <Mapper t={t} />,
 environment: <Environment360 t={t} />,
 hub: <HubDesign t={t} />,
 integration360: <Integration360Design t={t} />,
 security: <SecurityAdmin t={t} />,
 compare: <Compare t={t} />,
 };

 const signOut = async () => {
 try { await securityApi.logout(); } catch { /* the cookie goes either way */ }
 setMe(await securityApi.me());
 nav("home");
 };

 // Waiting on /auth/me. One frame, usually; a blank field rather than a
 // spinner, because a spinner that appears for 40ms is a flicker.
 if (me === undefined) {
 return <div style={{ minHeight: "100vh", background: t.bg }} />;
 }

 // Enforcement on and nobody signed in: the login screen is the whole app.
 // Not a modal over the shell -- a modal implies there is something behind
 // it worth closing, and there must not be.
 if (me.mode === "on" && !me.authenticated) {
 return <Login t={t} onSignedIn={setMe} />;
 }

 // A route the person cannot open. The sidebar already hides it; this is
 // the case where somebody typed the hash, and it has to say no in a way
 // that does not look like the module is broken.
 const denied = me.modules && !allowed(me.modules, route) && route !== "search";
 const body = denied ? <NoAccess t={t} route={route} /> : (screens[route] || screens.home);

 return (
 <AppShell t={t} route={route} onNav={nav} live={live} onSearch={() => nav("search")}
 onOpenHit={navTo} me={me} onSignOut={signOut}>
 {body}
 </AppShell>
 );
}

function NoAccess({ t, route }) {
 return (
 <div style={{ maxWidth: 560, marginTop: 40 }}>
 <h1 style={{ fontSize: 22, fontWeight: 500, color: t.accent, margin: 0 }}>
 You do not have access to this module</h1>
 <p style={{ fontSize: 13.5, color: t.sub, lineHeight: 1.6, marginTop: 14 }}>
 Your sign-in worked — <b>{route}</b> simply is not one of the modules
 granted to you. Access is granted per person by a CP 360 security
 administrator, under <b>Admin · Security Entitlement</b>. Ask for the
 module by name and they can tick it in one click.
 </p>
 </div>
 );
}
