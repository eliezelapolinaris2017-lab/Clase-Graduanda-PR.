(() => {
  const selectedStudent = () => {
    const email = document.querySelector('#reportEmail')?.value || '';
    return data.students.find(s => (s.email || '') === email) || null;
  };

  const safeFile = value => (value || 'reporte')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 -]/gi, '')
    .trim().replace(/\s+/g, '-').toLowerCase();

  function buildPdfDocument(student = null) {
    const month = document.querySelector('#reportMonth').value;
    if (!month) { toast('Selecciona el mes'); return null; }
    if (!window.jspdf?.jsPDF) { toast('No se pudo cargar el generador PDF'); return null; }

    const r = monthlyReport(month);
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'letter' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 42;
    let y = 48;

    const students = student ? r.students.filter(s => s.id == student.id) : r.students;
    const dues = student ? r.dues.filter(x => x.student_id == student.id) : r.dues;
    const acts = student ? r.acts.filter(x => x.student_id == student.id) : r.acts;
    const totalAmount = dues.reduce((a,x)=>a+Number(x.amount||0),0) + acts.reduce((a,x)=>a+Number(x.amount||0),0);
    const totalPaid = dues.reduce((a,x)=>a+Number(x.paid||0),0) + acts.reduce((a,x)=>a+Number(x.paid||0),0);
    const totalBalance = totalAmount - totalPaid;

    const addPageIfNeeded = (needed = 80) => {
      if (y + needed > pageHeight - 45) { doc.addPage(); y = 48; }
    };

    doc.setFont('helvetica','bold');
    doc.setFontSize(18);
    doc.text(data.settings.schoolName, margin, y);
    y += 24;
    doc.setFontSize(13);
    doc.text(data.settings.className, margin, y);
    y += 18;
    doc.setFont('helvetica','normal');
    doc.setFontSize(10);
    doc.text(`Estado de cuenta mensual - ${month}`, margin, y);
    y += 28;

    doc.autoTable({
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Resumen','Monto']],
      body: [
        ['Total asignado', money(totalAmount)],
        ['Total pagado', money(totalPaid)],
        ['Balance pendiente', money(totalBalance)]
      ],
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 5 },
      headStyles: { fontStyle: 'bold' }
    });
    y = doc.lastAutoTable.finalY + 24;

    students.forEach(s => {
      const studentDues = dues.filter(x => x.student_id == s.id);
      const studentActs = acts.filter(x => x.student_id == s.id);
      const duePayments = studentDues.filter(x => Number(x.paid) > 0).sort((a,b)=>(a.date||'').localeCompare(b.date||''));
      const actPayments = studentActs.filter(x => Number(x.paid) > 0).sort((a,b)=>(a.date||'').localeCompare(b.date||''));
      if (!studentDues.length && !studentActs.length) return;

      addPageIfNeeded(120);
      doc.setFont('helvetica','bold');
      doc.setFontSize(12);
      doc.text(`Estudiante: ${s.student_name}`, margin, y);
      y += 16;
      doc.setFont('helvetica','normal');
      doc.setFontSize(9.5);
      if (s.parent_name) { doc.text(`Padre/Madre/Encargado: ${s.parent_name}`, margin, y); y += 14; }
      if (s.email) { doc.text(`Email: ${s.email}`, margin, y); y += 14; }

      if (duePayments.length) {
        doc.autoTable({
          startY: y + 4,
          margin: { left: margin, right: margin },
          head: [['Pagos de Cuotas','Fecha','Pago','Balance']],
          body: duePayments.map(x => [x.concept, x.date, money(x.paid), money(Number(x.amount)-Number(x.paid))]),
          theme: 'striped',
          styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 4 },
          headStyles: { fontStyle: 'bold' }
        });
        y = doc.lastAutoTable.finalY + 14;
      } else {
        doc.setFont('helvetica','italic');
        doc.setFontSize(9);
        doc.text('No hay pagos de cuotas registrados en este mes.', margin, y + 5);
        y += 22;
      }

      addPageIfNeeded(90);
      if (actPayments.length) {
        doc.autoTable({
          startY: y,
          margin: { left: margin, right: margin },
          head: [['Pagos de Actividades','Fecha','Pago','Balance']],
          body: actPayments.map(x => [x.activity_name, x.date, money(x.paid), money(Number(x.amount)-Number(x.paid))]),
          theme: 'striped',
          styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 4 },
          headStyles: { fontStyle: 'bold' }
        });
        y = doc.lastAutoTable.finalY + 14;
      } else {
        doc.setFont('helvetica','italic');
        doc.setFontSize(9);
        doc.text('No hay pagos de actividades registrados en este mes.', margin, y + 5);
        y += 22;
      }

      const paid = studentDues.reduce((a,x)=>a+Number(x.paid||0),0) + studentActs.reduce((a,x)=>a+Number(x.paid||0),0);
      const balance = studentDues.reduce((a,x)=>a+Number(x.amount||0)-Number(x.paid||0),0) + studentActs.reduce((a,x)=>a+Number(x.amount||0)-Number(x.paid||0),0);
      addPageIfNeeded(55);
      doc.setFont('helvetica','bold');
      doc.setFontSize(9.5);
      doc.text(`Total pagado en el mes: ${money(paid)}`, margin, y); y += 14;
      doc.text(`Balance pendiente del estudiante: ${money(balance)}`, margin, y); y += 24;
      doc.setDrawColor(180);
      doc.line(margin, y, pageWidth - margin, y); y += 20;
    });

    const pages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      doc.setFont('helvetica','normal');
      doc.setFontSize(8);
      doc.text(`Página ${p} de ${pages}`, pageWidth - margin, pageHeight - 22, { align: 'right' });
    }

    const base = student ? safeFile(student.student_name) : safeFile(data.settings.className);
    return { doc, month, filename: `${base}-estado-de-cuenta-${month}.pdf`, student, totalPaid, totalBalance };
  }

  document.querySelector('#pdfReport').onclick = () => {
    const result = buildPdfDocument(selectedStudent());
    if (!result) return;
    result.doc.save(result.filename);
    toast('PDF descargado');
  };

  document.querySelector('#sendReport').onclick = async () => {
    const student = selectedStudent();
    if (!student) return toast('Selecciona un estudiante con email');

    const result = buildPdfDocument(student);
    if (!result) return;
    const blob = result.doc.output('blob');
    const file = new File([blob], result.filename, { type: 'application/pdf' });
    const subject = `${data.settings.className} - Estado de cuenta ${result.month}`;
    const body = `Saludos,\n\nAdjunto encontrará el estado de cuenta en PDF de ${student.student_name} correspondiente a ${result.month}.\n\nTotal pagado: ${money(result.totalPaid)}\nBalance pendiente: ${money(result.totalBalance)}\n\n${data.settings.schoolName}`;

    if (navigator.canShare && navigator.share && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: subject, text: body });
        toast('PDF listo para compartir');
        return;
      } catch (err) {
        if (err?.name === 'AbortError') return;
      }
    }

    result.doc.save(result.filename);
    toast('PDF descargado. Se abrirá el correo para adjuntarlo.');
    setTimeout(() => {
      location.href = `mailto:${encodeURIComponent(student.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body + '\n\nAdjunte el PDF descargado a este correo.')}`;
    }, 350);
  };
})();