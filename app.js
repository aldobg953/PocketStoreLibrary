const API = 'https://openlibrary.org/search.json';
const FIELDS = 'key,title,author_name,first_publish_year,cover_i';
const PAGE_SIZE = 24;

const GENRES = [
  ['fantasy', 'Fantasía'],
  ['science_fiction', 'Ciencia ficción'],
  ['mystery', 'Misterio'],
  ['romance', 'Romance'],
  ['horror', 'Terror'],
  ['history', 'Historia'],
  ['poetry', 'Poesía']
];

const CLOTH = ['#7a2e2a', '#2f4a3a', '#2c3e57', '#8a6420', '#4b3050'];

const BOOK_OPEN_ICON = '<svg viewBox="0 -960 960 960"><path d="M440-278v-394q-41-24-87-36t-93-12q-36 0-71.5 7T120-692v396q35-12 69.5-18t70.5-6q47 0 91.5 10.5T440-278ZM40-234v-482q0-11 5.5-21T62-752q46-24 96-36t102-12q74 0 126 17t112 52q11 6 16.5 14t5.5 21v418q44-21 88.5-31.5T700-320q36 0 70.5 6t69.5 18v-441q0-17 11.5-28.5T880-777q17 0 28.5 11.5T920-737v503q0 23-19.5 35t-40.5 1q-37-20-77.5-31T700-240q-49 0-95.5 14.5T516-185q-8 5-17.5 7.5T480-175q-9 0-18.5-2.5T444-185q-42-26-88.5-40.5T260-240q-42 0-82.5 11T100-198q-21 11-40.5-1T40-234Zm580-208v-369q0-13 7.5-23.5T647-849l54-18q14-5 26.5 4.5T740-838v369q0 13-7.5 23.5T713-431l-54 18q-14 5-26.5-4.5T620-442Zm-340-57Z"/></svg>';

const $shelf = document.getElementById('shelf');
const $genres = document.getElementById('genres');
const $count = document.getElementById('count');
const $more = document.getElementById('more');

const state = { subject: GENRES[0][0], page: 1, shown: 0, total: 0 };

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return Promise.resolve();
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.register('./sw.js');
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true });
    navigator.serviceWorker.register('./sw.js').catch(resolve);
    setTimeout(resolve, 3000);
  });
}

async function fetchBooks(subject, page) {
  const url = `${API}?subject=${subject}&fields=${FIELDS}&limit=${PAGE_SIZE}&page=${page}&sort=rating`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function loadBooks(reset) {
  const subject = state.subject;
  if (reset) {
    state.page = 1;
    state.shown = 0;
  }
  $more.disabled = true;

  try {
    const data = await fetchBooks(subject, state.page);
    if (subject !== state.subject) return;

    if (reset) $shelf.innerHTML = '';
    state.total = data.numFound;
    state.shown += data.docs.length;

    if (state.shown === 0) {
      showNotice('Este estante está vacío', 'No encontramos libros para este género.');
    } else {
      $shelf.insertAdjacentHTML('beforeend', data.docs.map(bookTemplate).join(''));
    }
    $count.textContent = `${state.shown.toLocaleString('es')} de ${state.total.toLocaleString('es')} libros`;
    $more.hidden = state.shown >= state.total;
  } catch (error) {
    if (subject !== state.subject) return;
    if (reset) {
      $shelf.innerHTML = '';
      showNotice('Sin conexión', 'Este género aún no está guardado. Conéctate a internet para cargarlo por primera vez.');
      $count.textContent = 'Sin datos guardados';
      $more.hidden = true;
    } else {
      state.page--;
      $count.textContent = `${state.shown.toLocaleString('es')} libros · no se pudieron cargar más sin conexión`;
    }
  } finally {
    $more.disabled = false;
  }
}

function bookTemplate(book, index) {
  const title = escapeHTML(book.title);
  const author = escapeHTML(book.author_name ? book.author_name[0] : 'Autor desconocido');
  const year = book.first_publish_year ? ` · ${book.first_publish_year}` : '';

  const art = book.cover_i
    ? `<div class="art"><img src="https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg" alt="Portada de ${title}" loading="lazy"></div>`
    : plainCover(title, index);

  return `
    <li class="book" style="--i:${index}">
      <div class="cover">${art}</div>
      <p class="tag"><strong>${title}</strong><span>${author}${year}</span></p>
    </li>`;
}

function plainCover(title, index) {
  return `<div class="art art--plain" style="--c:${CLOTH[index % CLOTH.length]}"><span>${title}</span></div>`;
}

function showNotice(title, text) {
  $shelf.innerHTML = `<li class="notice">${BOOK_OPEN_ICON}<strong>${title}</strong><p>${text}</p></li>`;
}

function escapeHTML(text) {
  return String(text).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function renderGenres() {
  $genres.innerHTML = GENRES.map(([id, label]) =>
    `<button class="chip${id === state.subject ? ' is-active' : ''}" type="button" data-subject="${id}">${label}</button>`
  ).join('');
}

$genres.addEventListener('click', (event) => {
  const chip = event.target.closest('.chip');
  if (!chip || chip.dataset.subject === state.subject) return;
  state.subject = chip.dataset.subject;
  $genres.querySelectorAll('.chip').forEach((c) => c.classList.toggle('is-active', c === chip));
  loadBooks(true);
});

$more.addEventListener('click', () => {
  state.page++;
  loadBooks(false);
});

$shelf.addEventListener('load', (event) => {
  if (event.target.tagName === 'IMG') event.target.classList.add('is-loaded');
}, true);

$shelf.addEventListener('error', (event) => {
  const img = event.target;
  if (img.tagName !== 'IMG') return;
  const index = [...$shelf.children].indexOf(img.closest('.book'));
  img.parentElement.outerHTML = plainCover(escapeHTML(img.alt.replace('Portada de ', '')), index);
}, true);

renderGenres();
registerServiceWorker().then(() => loadBooks(true));
