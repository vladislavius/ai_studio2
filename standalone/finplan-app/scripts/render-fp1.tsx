import React from 'react';
import { renderToString } from 'react-dom/server';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { FP1View } from '../src/components/FP1';
import { Dashboard } from '../src/components/Dashboard';
import { loadStoreInit } from './storeInit';

const store = loadStoreInit();
const currentPlan = store.plans[0];
const planForecasts = store.forecasts.filter(f => f.plan_id === currentPlan.id);
const planProposals = store.proposals.filter(p => p.plan_id === currentPlan.id);

function renderFull(content: string, css: string, title: string): string {
  return `<!doctype html><html lang="ru"><head>
  <meta charset="UTF-8"/>
  <title>${title}</title>
  <style>${css}</style>
  </head><body class="bg-slate-50"><div style="max-width:1300px;margin:0 auto;padding:24px;">${content}</div></body></html>`;
}

const css = fs.readFileSync(path.resolve(__dirname, '../dist/assets/' + fs.readdirSync(path.resolve(__dirname, '../dist/assets')).find(f => f.endsWith('.css'))!), 'utf-8');

const fp1Html = renderToString(
  <FP1View
    fp1={store.fp1}
    svdHistory={store.svd_history}
    docs={store.docs}
    plan={currentPlan}
    forecasts={planForecasts}
    onUpdateFp1={() => {}}
    onUpdateDocs={() => {}}
    onAdvanceStage={() => {}}
  />
);
fs.writeFileSync(path.resolve(__dirname, '../dist/fp1.html'), renderFull(fp1Html, css, 'ФП №1'));

const dashHtml = renderToString(
  <Dashboard
    plan={currentPlan}
    forecasts={planForecasts}
    proposals={planProposals}
    reserves={store.reserves}
    fp1={store.fp1}
    svdHistory={store.svd_history}
    onSwitchTab={() => {}}
  />
);
fs.writeFileSync(path.resolve(__dirname, '../dist/dashboard.html'), renderFull(dashHtml, css, 'Дашборд'));

console.log('Rendered: fp1.html, dashboard.html');
