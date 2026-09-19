(() => {
  const $ = s => document.querySelector(s);

  const safeFile = value => (value || 'reporte-global')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9 -]/gi,'')
    .trim().replace(/\s+/g,'-').toLowerCase();

  const totals = () => {
    const dues = Array.isArray(data?.dues) ? data.dues : [];
    const acts = Array.isArray(data?.activities) ? data.activities : [];
    const students = Array.isArray(data?.students) ? data.students : [];

    const dueAssigned = dues.reduce((a,x)=>a+Number(x.amount||0),0);
    const duePaid = dues.reduce((a,x)=>a+Number(x.paid||0),0);
    const actAssigned = acts.reduce((a,x)=>a+Number(x.amount||0),0);
    const actPaid = acts.reduce((a,x)=>a+Number(x.paid||0),0);

    const assigned = dueAssigned + actAssigned;
    const collected = duePaid + actPaid;
    const debt = assigned - collected;

    const rows = students.map(s => {
      const sd = dues.filter(x=>String(x.student_id)===String(s.id));
      const sa = acts.filter(x=>String(x.student_id)===String(s.id));
      const studentAssigned =
        sd.reduce((a,x)=>a+Number(x.amount||0),0) +
        sa.reduce((a,x)=>a+Number(x.amount||0),0);
      const studentCollected =
        sd.reduce((a,x)=>a+Number(x.paid||0),0) +
        sa.reduce((a,x)=>a+Number(x.paid||0),0);
      const studentDebt = studentAssigned - studentCollected;

      return {
        id:s.id,
        name:s.student_name || '',
        parent:s.parent_name || '',
        assigned:studentAssigned,
        collected:studentCollected,
        debt:studentDebt
      };
    }).sort((a,b)=>b.debt-a.debt || a.name.localeCompare(b.name));

    return {
      assigned,
      collected,
      debt,
      dueAssigned,
      duePaid,
      dueDebt: dueAssigned-duePaid,
      actAssigned,
      actPaid,
      actDebt: actAssigned-actPaid,
      students:students.length,
      rows
    };
  };

  function renderGlobal(){
    const summary = $('#globalReportSummary');
    const table = $('#globalReportTable');
    if(!summary || !table) return;

    const r = totals();

    summary.innerHTML = `
      <div class="card"><small>Total asignado global</small><strong>${money(r.assigned)}</strong></div>
      <div class="card"><small>Total recaudado global</small><strong>${money(r.collected)}</strong></div>
      <div class="card"><small>Deuda global pendiente</small><strong>${money(r.debt)}</strong></div>
      <div class="card"><small>Estudiantes</small><strong>${r.students}</strong></div>
    `;

    table.innerHTML = `
      <tr>
        <th>Estudiante</th>
        <th>Padre/Madre</th>
        <th>Asignado</th>
        <th>Recaudado</th>
        <th>Deuda</th>
      </tr>
    ` + r.rows.map(x=>`
      <tr>
        <td>${esc(x.name)}</td>
        <td>${esc(x.parent)}</td>
        <td>${money(x.assigned)}</td>
        <td>${money(x.collected)}</td>
        <td><strong>${money(x.debt)}</strong></td>
      </tr>
    `).join('');
  }

  const loadScript = src => new Promise((resolve,reject)=>{
    const found=[...document.scripts].find(s=>s.src===src);
    if(found){
      setTimeout(resolve,50);
      return;
    }
    const s=document.createElement('script');
    s.src=src;
    s.onload=resolve;
    s.onerror=reject;
    document.head.appendChild(s);
  });

  async function ensurePdf(){
    if(!window.jspdf?.jsPDF){
      for(const src of [
        'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js',
        'https://unpkg.com/jspdf@2.5.2/dist/jspdf.umd.min.js'
      ]){
        try{
          await loadScript(src);
          if(window.jspdf?.jsPDF) break;
        }catch{}
      }
    }
    if(!window.jspdf?.jsPDF) return false;

    let d=new window.jspdf.jsPDF();
    if(typeof d.autoTable!=='function'){
      for(const src of [
        'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js',
        'https://unpkg.com/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js'
      ]){
        try{
          await loadScript(src);
          d=new window.jspdf.jsPDF();
          if(typeof d.autoTable==='function') break;
        }catch{}
      }
    }
    return typeof new window.jspdf.jsPDF().autoTable==='function';
  }

  async function downloadGlobalPdf(){
    const r=totals();
    if(!r.assigned && !r.collected && !r.rows.length){
      toast('No hay datos para generar el reporte global');
      return;
    }

    toast('Preparando PDF global...');
    if(!await ensurePdf()){
      toast('No se pudo cargar el generador PDF');
      return;
    }

    const {jsPDF}=window.jspdf;
    const doc=new jsPDF({unit:'pt',format:'letter'});
    const w=doc.internal.pageSize.getWidth();
    const h=doc.internal.pageSize.getHeight();
    const m=38;
    let y=46;

    doc.setFont('helvetica','bold');
    doc.setFontSize(18);
    doc.text(data.settings?.schoolName || 'Clase Graduanda PR',m,y);
    y+=23;

    doc.setFontSize(13);
    doc.text(data.settings?.className || 'Clase Graduanda',m,y);
    y+=18;

    doc.setFont('helvetica','normal');
    doc.setFontSize(10);
    doc.text('Balance global de recaudación y deuda',m,y);
    y+=25;

    doc.autoTable({
      startY:y,
      margin:{left:m,right:m},
      head:[['Resumen global','Monto']],
      body:[
        ['Total asignado global',money(r.assigned)],
        ['Total recaudado global',money(r.collected)],
        ['Deuda global pendiente',money(r.debt)],
        ['Recaudado en cuotas',money(r.duePaid)],
        ['Deuda en cuotas',money(r.dueDebt)],
        ['Recaudado en actividades',money(r.actPaid)],
        ['Deuda en actividades',money(r.actDebt)],
        ['Estudiantes',String(r.students)]
      ],
      theme:'grid',
      styles:{fontSize:9,cellPadding:5},
      headStyles:{fontStyle:'bold'}
    });

    y=doc.lastAutoTable.finalY+22;

    doc.autoTable({
      startY:y,
      margin:{left:m,right:m},
      head:[['Estudiante','Padre/Madre','Asignado','Recaudado','Deuda']],
      body:r.rows.map(x=>[
        x.name,
        x.parent,
        money(x.assigned),
        money(x.collected),
        money(x.debt)
      ]),
      theme:'striped',
      styles:{fontSize:8,cellPadding:3.5},
      headStyles:{fontStyle:'bold'},
      columnStyles:{
        0:{cellWidth:125},
        1:{cellWidth:125},
        2:{cellWidth:85},
        3:{cellWidth:85},
        4:{cellWidth:85}
      }
    });

    const pages=doc.internal.getNumberOfPages();
    for(let p=1;p<=pages;p++){
      doc.setPage(p);
      doc.setFont('helvetica','normal');
      doc.setFontSize(8);
      doc.text(`Página ${p} de ${pages}`,w-m,h-22,{align:'right'});
    }

    const base=safeFile(data.settings?.className || 'clase-graduanda');
    doc.save(`${base}-balance-global.pdf`);
    toast('PDF global descargado');
  }

  $('#globalPdfReport')?.addEventListener('click',downloadGlobalPdf);

  document.querySelector('.tab[data-tab="reports"]')?.addEventListener('click',()=>{
    setTimeout(renderGlobal,0);
  });

  if(typeof render==='function'){
    const previousRender=render;
    render=function(){
      previousRender();
      renderGlobal();
    };
  }

  renderGlobal();
})();