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

function currentRoute() {
 const h = (window.location.hash || "#home").replace(/^#/, "");
 return h.split("?")[0] || "home";
}

export default function App() {
 const t = tLight;
 const [route, setRoute] = useState(currentRoute());
 const [live, setLive] = useState(false);
 const [selection, setSelection] = useState(null); // deep-link target from search

 useEffect(() => {
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
 };

 return (
 <AppShell t={t} route={route} onNav={nav} live={live} onSearch={() => nav("search")}
 onOpenHit={navTo}>
 {screens[route] || screens.home}
 </AppShell>
 );
}
