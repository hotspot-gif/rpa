import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { RetailerSummary, RetailerMonthly } from '@/types';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const fmt = (v: number) => `€${v.toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtN = (v: number) => v.toLocaleString('en-IE');
const fmtP = (v: number) => `${v.toFixed(1)}%`;

function addFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(
      'CONFIDENTIAL — Proprietary retailer performance data. For internal use only. Unauthorised distribution prohibited.',
      pw / 2, ph - 8, { align: 'center' }
    );
    doc.text(`Page ${i} of ${pageCount}`, pw - 14, ph - 8, { align: 'right' });
  }
}

export async function generatePDF(summary: RetailerSummary, monthly: RetailerMonthly[]) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pw = doc.internal.pageSize.getWidth();
  let y = 15;

  // --- Header ---
  doc.setFillColor(33, 38, 78);
  doc.rect(0, 0, pw, 35, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Retailer Performance Report', 14, y + 5);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${new Date().toLocaleDateString('en-IE', { day: '2-digit', month: 'long', year: 'numeric' })}`, 14, y + 14);
  y = 45;

  // --- Retailer Info ---
  doc.setTextColor(33, 38, 78);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Retailer Details', 14, y);
  y += 8;

  autoTable(doc, {
    startY: y,
    head: [['Retailer ID', 'Branch', 'Zone', 'Last Updated']],
    body: [[
      summary.retailer_id,
      summary.branch,
      summary.zone,
      new Date(summary.updated_at).toLocaleDateString('en-IE'),
    ]],
    theme: 'grid',
    headStyles: { fillColor: [33, 38, 78], textColor: 255, fontSize: 9 },
    bodyStyles: { textColor: [33, 38, 78], fontSize: 9 },
    margin: { left: 14, right: 14 },
  });

  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  // --- All-Time KPI Summary ---
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('All-Time KPI Summary', 14, y);
  y += 8;

  autoTable(doc, {
    startY: y,
    head: [['Metric', 'Value']],
    body: [
      ['Total Incentive', fmt(summary.incentive)],
      ['GA Activations', fmtN(summary.ga_cnt)],
      ['Port-In', fmtN(summary.port_in)],
      ['Port-Out', fmtN(summary.port_out)],
      ['PI Raw', fmt(summary.pi_raw)],
      ['Add GARA', fmt(summary.add_gara)],
      ['PI Total', fmt(summary.pi_total)],
      ['P-IN ≤€6.99', fmtN(summary.pi_l6)],
      ['P-IN >€6.99', fmtN(summary.pi_g6)],
      ['NEW ≤€6.99', fmtN(summary.np_l6)],
      ['NEW >€6.99', fmtN(summary.np_g6)],
      ['Total Deductions', fmt(summary.total_deductions)],
      ['PO Deduction', fmt(summary.po_deduction)],
      ['Clawback', fmt(summary.clawback)],
      ['Renewal Impact', fmt(summary.renewal_impact)],
      ['Renewal Rate', fmtP(summary.renewal_rate)],
    ],
    theme: 'striped',
    headStyles: { fillColor: [33, 38, 78], textColor: 255, fontSize: 9 },
    bodyStyles: { textColor: [33, 38, 78], fontSize: 9 },
    alternateRowStyles: { fillColor: [255, 247, 242] },
    margin: { left: 14, right: 14 },
    didParseCell: (data) => {
      // Red for deductions
      if (data.section === 'body') {
        const label = data.row.cells[0]?.text?.[0] || '';
        if (['Total Deductions', 'PO Deduction', 'Clawback', 'Renewal Impact'].includes(label) && data.column.index === 1) {
          data.cell.styles.textColor = [240, 68, 56];
        }
      }
    },
  });

  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  // --- Yearly Overview ---
  const years = [...new Set(monthly.map(m => m.month.substring(0, 4)))].sort();
  const yearlyTotals = years.map(yr => {
    const mos = monthly.filter(m => m.month.startsWith(yr));
    return {
      year: yr,
      incentive: mos.reduce((s, m) => s + m.incentive, 0),
      ga_cnt: mos.reduce((s, m) => s + m.ga_cnt, 0),
      port_in: mos.reduce((s, m) => s + m.port_in, 0),
      port_out: mos.reduce((s, m) => s + m.port_out, 0),
      pi_l6: mos.reduce((s, m) => s + m.pi_l6, 0),
      pi_g6: mos.reduce((s, m) => s + m.pi_g6, 0),
      np_l6: mos.reduce((s, m) => s + m.np_l6, 0),
      np_g6: mos.reduce((s, m) => s + m.np_g6, 0),
      pi_raw: mos.reduce((s, m) => s + m.pi_raw, 0),
      add_gara: mos.reduce((s, m) => s + m.add_gara, 0),
      pi_total: mos.reduce((s, m) => s + m.pi_total, 0),
      total_ded: mos.reduce((s, m) => s + m.total_ded, 0),
      po_deduction: mos.reduce((s, m) => s + m.po_deduction, 0),
      clawback: mos.reduce((s, m) => s + m.clawback, 0),
      renewal_impact: mos.reduce((s, m) => s + m.renewal_impact, 0),
      renewal_rate: mos.length > 0 ? mos.reduce((s, m) => s + m.renewal_rate, 0) / mos.length : 0,
    };
  });

  if (y > 240) { doc.addPage(); y = 15; }
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(33, 38, 78);
  doc.text('Year-by-Year Overview', 14, y);
  y += 8;

  autoTable(doc, {
    startY: y,
    head: [['Metric', ...years.map(yr => yr)]],
    body: [
      ['Incentive', ...yearlyTotals.map(yt => fmt(yt.incentive))],
      ['GA Activations', ...yearlyTotals.map(yt => fmtN(yt.ga_cnt))],
      ['Port-In', ...yearlyTotals.map(yt => fmtN(yt.port_in))],
      ['Port-Out', ...yearlyTotals.map(yt => fmtN(yt.port_out))],
      ['P-IN ≤€6.99', ...yearlyTotals.map(yt => fmtN(yt.pi_l6))],
      ['P-IN >€6.99', ...yearlyTotals.map(yt => fmtN(yt.pi_g6))],
      ['NEW ≤€6.99', ...yearlyTotals.map(yt => fmtN(yt.np_l6))],
      ['NEW >€6.99', ...yearlyTotals.map(yt => fmtN(yt.np_g6))],
      ['PI Raw', ...yearlyTotals.map(yt => fmt(yt.pi_raw))],
      ['Add GARA', ...yearlyTotals.map(yt => fmt(yt.add_gara))],
      ['PI Total', ...yearlyTotals.map(yt => fmt(yt.pi_total))],
      ['Total Deductions', ...yearlyTotals.map(yt => fmt(yt.total_ded))],
      ['PO Deduction', ...yearlyTotals.map(yt => fmt(yt.po_deduction))],
      ['Clawback', ...yearlyTotals.map(yt => fmt(yt.clawback))],
      ['Renewal Impact', ...yearlyTotals.map(yt => fmt(yt.renewal_impact))],
      ['Renewal Rate (Avg)', ...yearlyTotals.map(yt => fmtP(yt.renewal_rate))],
    ],
    theme: 'grid',
    headStyles: { fillColor: [33, 38, 78], textColor: 255, fontSize: 8 },
    bodyStyles: { textColor: [33, 38, 78], fontSize: 8 },
    margin: { left: 14, right: 14 },
    didParseCell: (data) => {
      if (data.section === 'body') {
        const label = data.row.cells[0]?.text?.[0] || '';
        if (['Total Deductions', 'PO Deduction', 'Clawback', 'Renewal Impact'].includes(label) && data.column.index > 0) {
          data.cell.styles.textColor = [240, 68, 56];
        }
      }
    },
  });

  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  // --- Monthly Performance Table ---
  doc.addPage();
  y = 15;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(33, 38, 78);
  doc.text('Monthly Performance Data', 14, y);
  y += 8;

  const sortedMonthly = [...monthly].sort((a, b) => a.month.localeCompare(b.month));

  autoTable(doc, {
    startY: y,
    head: [['Month', 'Incentive', 'GA', 'Port-In', 'PI≤6.99', 'PI>6.99', 'NP≤6.99', 'NP>6.99', 'Deductions', 'Renewal%']],
    body: sortedMonthly.map(m => {
      const [yr, mo] = m.month.split('-');
      const label = `${MONTH_NAMES[parseInt(mo) - 1]} ${yr}`;
      return [
        label,
        fmt(m.incentive),
        fmtN(m.ga_cnt),
        fmtN(m.port_in),
        fmtN(m.pi_l6),
        fmtN(m.pi_g6),
        fmtN(m.np_l6),
        fmtN(m.np_g6),
        fmt(m.total_ded),
        fmtP(m.renewal_rate),
      ];
    }),
    theme: 'striped',
    headStyles: { fillColor: [33, 38, 78], textColor: 255, fontSize: 7 },
    bodyStyles: { textColor: [33, 38, 78], fontSize: 7 },
    alternateRowStyles: { fillColor: [255, 247, 242] },
    margin: { left: 14, right: 14 },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 8) {
        data.cell.styles.textColor = [240, 68, 56];
      }
    },
  });

  // --- Monthly Deductions Table ---
  doc.addPage();
  y = 15;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(33, 38, 78);
  doc.text('Monthly Deductions Breakdown', 14, y);
  y += 8;

  autoTable(doc, {
    startY: y,
    head: [['Month', 'PO Deduction', 'Clawback', 'Renewal Impact', 'Total Deductions']],
    body: sortedMonthly.map(m => {
      const [yr, mo] = m.month.split('-');
      const label = `${MONTH_NAMES[parseInt(mo) - 1]} ${yr}`;
      return [label, fmt(m.po_deduction), fmt(m.clawback), fmt(m.renewal_impact), fmt(m.total_ded)];
    }),
    theme: 'striped',
    headStyles: { fillColor: [240, 68, 56], textColor: 255, fontSize: 8 },
    bodyStyles: { textColor: [240, 68, 56], fontSize: 8 },
    alternateRowStyles: { fillColor: [255, 240, 240] },
    margin: { left: 14, right: 14 },
  });

  // --- Monthly Port-In & GARA ---
  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;

  if (y > 200) { doc.addPage(); y = 15; }
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(33, 38, 78);
  doc.text('Port-In Incentive & GARA Bonus', 14, y);
  y += 8;

  autoTable(doc, {
    startY: y,
    head: [['Month', 'PI Raw', 'Add GARA', 'PI Total', 'Port-In', 'Port-Out']],
    body: sortedMonthly.map(m => {
      const [yr, mo] = m.month.split('-');
      const label = `${MONTH_NAMES[parseInt(mo) - 1]} ${yr}`;
      return [label, fmt(m.pi_raw), fmt(m.add_gara), fmt(m.pi_total), fmtN(m.port_in), fmtN(m.port_out)];
    }),
    theme: 'striped',
    headStyles: { fillColor: [33, 38, 78], textColor: 255, fontSize: 8 },
    bodyStyles: { textColor: [33, 38, 78], fontSize: 8 },
    alternateRowStyles: { fillColor: [255, 247, 242] },
    margin: { left: 14, right: 14 },
  });

  // --- Add footers ---
  addFooter(doc);

  doc.save(`Retailer_${summary.retailer_id}_Report.pdf`);
}
