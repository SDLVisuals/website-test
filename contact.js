/* Prepare a mail draft locally. The visitor reviews and sends it in their own mail app. */
(() => {
  'use strict';
  const buildDraft = values => {
    const line = value => String(value || '').replace(/[\r\n]+/g, ' ').trim();
    const name = line(values.name);
    const service = line(values.service);
    const subject = `Projectaanvraag · ${service} · ${name}`;
    const body = [
      'Dag Seppe,', '',
      'Ik bespreek graag een project met je.', '',
      `Type project: ${service}`,
      `Naam: ${name}`,
      `E-mailadres: ${line(values.email)}`,
      `Wanneer: ${line(values.date) || 'Nog te bepalen'}`, '',
      'Mijn idee:', String(values.idea || '').trim(), '',
      'Groeten,', name
    ].join('\r\n');
    return {subject, body, text: `Aan: info@sdlvisuals.be\nOnderwerp: ${subject}\n\n${body}`, url: `mailto:info@sdlvisuals.be?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`};
  };

  const form = document.querySelector('#project-brief');
  if (!form) return;
  const controls = {
    name: form.querySelector('#brief-name'),
    email: form.querySelector('#brief-email'),
    date: form.querySelector('#brief-date'),
    idea: form.querySelector('#brief-idea')
  };
  const radios = [...form.querySelectorAll('[name="service"]')];
  const serviceField = form.querySelector('#service-field');
  const status = form.querySelector('#brief-status');
  const preview = form.querySelector('#draft-preview');
  const draftText = form.querySelector('#draft-text');
  const copyButton = form.querySelector('#copy-draft');
  const submit = form.querySelector('#open-draft');
  let attempted = false;
  let draft = null;
  const choices = new Map([['fotografie','Fotografie'],['videografie','Videografie'],['drone','Drone'],['combinatie','Combinatie']]);
  const preferred = choices.get(new URLSearchParams(window.location.search).get('dienst')?.toLowerCase());
  if (preferred) radios.forEach(radio => { radio.checked = radio.value === preferred; });
  const selectedService = () => radios.find(radio => radio.checked)?.value || '';

  function showError(key, message) {
    const error = form.querySelector(`#${key}-error`);
    error.textContent = message;
    error.hidden = !message;
    if (key === 'service') {
      serviceField.classList.toggle('has-error', Boolean(message));
      radios.forEach(radio => radio.setAttribute('aria-invalid', String(Boolean(message))));
    } else {
      controls[key].closest('.contact-field').classList.toggle('has-error', Boolean(message));
      controls[key].setAttribute('aria-invalid', String(Boolean(message)));
    }
  }

  function validate() {
    const errors = {
      service: selectedService() ? '' : 'Kies fotografie, videografie, drone of een combinatie.',
      name: controls.name.value.trim() ? '' : 'Vul je naam in.',
      email: !controls.email.value.trim() ? 'Vul je e-mailadres in.' : controls.email.validity.typeMismatch ? 'Vul een geldig e-mailadres in.' : '',
      idea: controls.idea.value.trim() ? '' : 'Vertel kort wat je in gedachten hebt.'
    };
    Object.entries(errors).forEach(([key,message]) => showError(key,message));
    return Object.keys(errors).find(key => errors[key]) || null;
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    attempted = true;
    const invalid = validate();
    if (invalid) {
      status.textContent = 'Kijk de aangeduide velden nog even na.';
      const target = invalid === 'service' ? radios[0] : controls[invalid];
      target.focus();
      return;
    }
    draft = buildDraft({service:selectedService(),name:controls.name.value,email:controls.email.value,date:controls.date.value,idea:controls.idea.value});
    draftText.value = draft.text;
    preview.hidden = false;
    status.textContent = 'Je projectbrief is voorbereid. Controleer het concept in je e-mailapp en verzend het zelf. Opent die niet? Hieronder kun je de brief kopiëren.';
    try { window.location.assign(draft.url); }
    catch {
      preview.open = true;
      status.textContent = 'Je projectbrief is voorbereid. Kopieer hem hieronder en mail naar info@sdlvisuals.be.';
    }
  });
  form.addEventListener('input', event => {
    if (attempted && event.target !== draftText) validate();
    if (draft && event.target !== draftText) {
      draft = null;
      preview.hidden = true;
      status.textContent = 'Je hebt je brief aangepast. Open opnieuw een e-mailconcept om je wijzigingen mee te nemen.';
    }
  });
  copyButton.addEventListener('click', async () => {
    if (!draft) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(draft.text);
      status.textContent = 'Je projectbrief is gekopieerd. Plak hem in een e-mail aan info@sdlvisuals.be en verzend hem zelf.';
    } catch {
      preview.open = true;
      draftText.focus();
      draftText.select();
      status.textContent = 'Je brief is geselecteerd. Kopieer de tekst en plak hem in een e-mail aan info@sdlvisuals.be.';
    }
  });
  submit.disabled = false;
})();
