(() => {
  const $ = s => document.querySelector(s);
  const safeFile = value => (value || 'reporte').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9 -]/gi,'').trim().replace(/\s+/g,'-').toLowerCase();
  const method = x => Number(x.paid) > 0 ? (x.payment_method || 'No especificado') : '—';

  const loadScript = src => new Promise((resolve,reject)=>{
    const found=[...document.scripts].find(s=>s.src===src);
    if(found){ found.addEventListener('load',resolve,{once:true}); found.addEventListener('error',reject,{once:true}); setTimeout(resolve,50); return; }
    const s=document.createElement('script'); s.src=src; s.onload=resolve; s.onerror=reject; document.head.appendChild(s);
  });

  async function ensurePdf(){
    if(!window.jspdf?.jsPDF){
      for(const src of ['https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js','https://unpkg.com/jspdf@2.5.2/dist/jspdf.umd.min.js']){
        try{await loadScript(src); if(window.jspdf?.jsPDF) break;}catch{}
      }
    }
    if(!window.jspdf?.jsPDF) return false;
    let d=new window.jspdf.jsPDF();
    if(typeof d.autoTable!=='function'){
      for(const src of ['https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js','https://unpkg.com/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js']){
        try{await loadScript(src); d=new window.jspdf.jsPDF(); if(typeof d.autoTable==='function') break;}catch{}
      }
    }
    return typeof new window.jspdf.jsPDF().autoTable==='function';
  }

  const selectedStudent=()=>{
    const email=$('#reportEmail')?.value||'';
    return data.students.find(s=>(s.email||'')===email)||null;
  };

  async function build(student=null){
    const month=$('#reportMonth')?.value;
    if(!month){toast('Selecciona el mes');return null;}
    toast('Preparando PDF...');
    if(!await ensurePdf()){toast('No se pudo cargar el generador PDF');return null;}

    const r=monthlyReport(month);
    const students=student?r.students.filter(s=>s.id==student.id):r.students;
    const dues=student?r.dues.filter(x=>x.student_id==student.id):r.dues;
    const acts=student?r.acts.filter(x=>x.student_id==student.id):r.acts;
    const totalPaid=dues.reduce((a,x)=>a+Number(x.paid||0),0)+acts.reduce((a,x)=>a+Number(x.paid||0),0);
    const totalAmount=dues.reduce((a,x)=>a+Number(x.amount||0),0)+acts.reduce((a,x)=>a+Number(x.amount||0),0);
    const totalBalance=totalAmount-totalPaid;

    const {jsPDF}=window.jspdf;
    const doc=new jsPDF({unit:'pt',format:'letter'});
    const w=doc.internal.pageSize.getWidth(), h=doc.internal.pageSize.getHeight(), m=38;
    let y=45;
    const page=(need=90)=>{if(y+need>h-45){doc.addPage();y=45;}};

    doc.setFont('helvetica','bold'); doc.setFontSize(18); doc.text(data.settings.schoolName,m,y); y+=23;
    doc.setFontSize(13); doc.text(data.settings.className,m,y); y+=18;
    doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.text(`Estado de cuenta mensual - ${month}`,m,y); y+=26;

    doc.autoTable({startY:y,margin:{left:m,right:m},head:[['Resumen','Monto']],body:[['Total asignado',money(totalAmount)],['Total pagado',money(totalPaid)],['Balance pendiente',money(totalBalance)]],theme:'grid',styles:{fontSize:9,cellPadding:5},headStyles:{fontStyle:'bold'}});
    y=doc.lastAutoTable.finalY+22;

    students.forEach(s=>{
      const sd=dues.filter(x=>x.student_id==s.id);
      const sa=acts.filter(x=>x.student_id==s.id);
      const dp=sd.filter(x=>Number(x.paid)>0).sort((a,b)=>(a.date||'').localeCompare(b.date||''));
      const ap=sa.filter(x=>Number(x.paid)>0).sort((a,b)=>(a.date||'').localeCompare(b.date||''));
      if(!sd.length&&!sa.length)return;

      page(125);
      doc.setFont('helvetica','bold');doc.setFontSize(12);doc.text(`Estudiante: ${s.student_name}`,m,y);y+=16;
      doc.setFont('helvetica','normal');doc.setFontSize(9.5);
      if(s.parent_name){doc.text(`Padre/Madre/Encargado: ${s.parent_name}`,m,y);y+=14;}
      if(s.email){doc.text(`Email: ${s.email}`,m,y);y+=14;}

      if(dp.length){
        doc.autoTable({startY:y+4,margin:{left:m,right:m},head:[['Cuota','Fecha','Pago','Método','Balance']],body:dp.map(x=>[x.concept,x.date,money(x.paid),method(x),money(Number(x.amount)-Number(x.paid))]),theme:'striped',styles:{fontSize:8,cellPadding:3.5},headStyles:{fontStyle:'bold'},columnStyles:{0:{cellWidth:150},1:{cellWidth:70},2:{cellWidth:70},3:{cellWidth:95},4:{cellWidth:75}}});
        y=doc.lastAutoTable.finalY+14;
      }else{doc.setFont('helvetica','italic');doc.setFontSize(9);doc.text('No hay pagos de cuotas registrados en este mes.',m,y+5);y+=22;}

      page(100);
      if(ap.length){
        doc.autoTable({startY:y,margin:{left:m,right:m},head:[['Actividad','Fecha','Pago','Método','Balance']],body:ap.map(x=>[x.activity_name,x.date,money(x.paid),method(x),money(Number(x.amount)-Number(x.paid))]),theme:'striped',styles:{fontSize:8,cellPadding:3.5},headStyles:{fontStyle:'bold'},columnStyles:{0:{cellWidth:150},1:{cellWidth:70},2:{cellWidth:70},3:{cellWidth:95},4:{cellWidth:75}}});
        y=doc.lastAutoTable.finalY+14;
      }else{doc.setFont('helvetica','italic');doc.setFontSize(9);doc.text('No hay pagos de actividades registrados en este mes.',m,y+5);y+=22;}

      const paid=sd.reduce((a,x)=>a+Number(x.paid||0),0)+sa.reduce((a,x)=>a+Number(x.paid||0),0);
      const bal=sd.reduce((a,x)=>a+Number(x.amount||0)-Number(x.paid||0),0)+sa.reduce((a,x)=>a+Number(x.amount||0)-Number(x.paid||0),0);
      page(55);doc.setFont('helvetica','bold');doc.setFontSize(9.5);doc.text(`Total pagado en el mes: ${money(paid)}`,m,y);y+=14;doc.text(`Balance pendiente del estudiante: ${money(bal)}`,m,y);y+=24;doc.setDrawColor(180);doc.line(m,y,w-m,y);y+=18;
    });

    const pages=doc.internal.getNumberOfPages();
    for(let p=1;p<=pages;p++){doc.setPage(p);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.text(`Página ${p} de ${pages}`,w-m,h-22,{align:'right'});}
    const base=student?safeFile(student.student_name):safeFile(data.settings.className);
    return {doc,month,filename:`${base}-estado-de-cuenta-${month}.pdf`,student,totalPaid,totalBalance};
  }

  $('#pdfReport').onclick=async()=>{const r=await build(selectedStudent());if(!r)return;r.doc.save(r.filename);toast('PDF descargado');};

  $('#sendReport').onclick=async()=>{
    const student=selectedStudent();
    if(!student)return toast('Selecciona un estudiante con email');
    const r=await build(student);if(!r)return;
    const subject=`${data.settings.className} - Estado de cuenta ${r.month}`;
    const body=`Saludos,\n\nAdjunto encontrará el estado de cuenta en PDF de ${student.student_name} correspondiente a ${r.month}.\n\nTotal pagado: ${money(r.totalPaid)}\nBalance pendiente: ${money(r.totalBalance)}\n\n${data.settings.schoolName}\n\nEl PDF fue descargado automáticamente. Favor adjuntarlo antes de enviar este correo.`;
    r.doc.save(r.filename);
    toast(`PDF descargado. Abriendo correo para ${student.email}`);
    setTimeout(()=>{location.href=`mailto:${encodeURIComponent(student.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;},450);
  };
})();