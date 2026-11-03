/* Isolated comparison host. Never writes the density/material choices to storage,
   and never modifies the production map implementation or dataset. */
(function () {
  'use strict';
  var form = document.getElementById('kit2-controls');
  var frame = document.getElementById('kit2-frame');
  var description = document.getElementById('kit2-description');
  var doc, observer, themeObserver, page = 0, showingDetail = false;
  // Shareable local comparisons, without persistent preferences.
  var initial = new URLSearchParams(location.search);
  ['device','density','theme','material','geo'].forEach(function (name) {
    var selected=initial.get(name), field=form.elements[name];
    if (selected && Array.from(field.options).some(function (option) { return option.value===selected; })) field.value=selected;
  });
  var bands = [
    { start: 0, end: 6, name: 'Запад' },
    { start: 7, end: 12, name: 'Центр карты' },
    { start: 13, end: 18, name: 'Восток' }
  ];


  function val(name) { return form.elements[name].value; }
  function tiles() { return doc ? Array.from(doc.querySelectorAll('#fm-map .dk-map__tile')) : []; }
  function scrollToPart(id) {
    var target = doc && doc.getElementById(id);
    if (target) target.scrollIntoView({ block:'start' });
  }
  function updateDescription() {
    var density = {
      spacious:'Просторная: больше полей и высоты строк; текст и показатели сохранены.',
      comfortable:'Обычная: текущие интервалы кита.',
      compact:'Компактная: текущие более плотные виджеты и таблицы; текст не уменьшается.'
    }[val('density')];
    var geo = {
      panorama:'Панорама: все 89 регионов в одной сетке, плитки 44 px. Для восточных регионов нужно движение по горизонтали.',
      pages:'Страницы: Запад / Центр карты / Восток. Плитки 44 px; координаты внутри исходных полос сохраняются. Вся страна — за три перехода.',
      overview:'Обзор → фрагмент: сначала вся география цветом без мелких надписей, затем читаемая полоса по нажатию. Цена — дополнительный переход.'
    }[val('geo')];
    description.textContent = density + (val('device') === '390' ? ' ' + geo : '') +
      ' Материал: выбранный графит Dark/Light; плотность и географическая раскладка здесь остаются предложениями.';
  }
  function decorateMap() {
    if (!doc) return;
    var mobile = val('device') === '390';
    var host = doc.getElementById('fm-map');
    var grid = host && host.querySelector('.dk-map__tiles');
    var all = tiles();
    var controls = doc.getElementById('kit2-geo-tools');
    var overview = doc.getElementById('kit2-overview');
    if (!mobile || !grid || !all.length) {
      if (controls) controls.remove();
      if (overview) overview.remove();
      all.forEach(function (tile) { tile.hidden=false; tile.style.removeProperty('grid-column'); tile.style.gridColumn=String(Number(tile.dataset.col)+1); });
      return;
    }
    if (!controls) {
      controls = doc.createElement('div');
      controls.id='kit2-geo-tools'; controls.className='kit2-geo-tools'; controls.setAttribute('role','group'); controls.setAttribute('aria-label','Части исходной карты');
      host.before(controls);
      controls.addEventListener('click', function (event) {
        var button=event.target.closest('button'); if (!button) return;
        if (button.dataset.band === 'all') showingDetail=false;
        else { page=Number(button.dataset.band); showingDetail=true; }
        decorateMap();
        var active=controls.querySelector('[data-band="'+button.dataset.band+'"]'); if (active) active.focus();
      });
    }
    controls.replaceChildren();
    if (val('geo') === 'overview' && showingDetail) {
      var back=doc.createElement('button'); back.type='button'; back.dataset.band='all'; back.textContent='← Вся карта'; controls.append(back);
    }
    bands.forEach(function (band,index) {
      var button=doc.createElement('button'); button.type='button'; button.dataset.band=String(index);
      var count=all.filter(function (tile) { var col=Number(tile.dataset.col); return col>=band.start && col<=band.end; }).length;
      button.textContent=band.name+' · '+count; button.setAttribute('aria-pressed',String(index===page && (val('geo')!=='overview'||showingDetail)));
      button.addEventListener('click', function () {
        if (val('geo')==='panorama') {
          var pan=host.querySelector('.dk-map__pan'); pan.scrollTo({left:band.start*(44+(Number.parseFloat(doc.defaultView.getComputedStyle(grid).columnGap)||0)),behavior:'auto'});
        }
      });
      controls.append(button);
    });
    if (overview) overview.remove();
    if (val('geo') === 'overview') {
      overview=doc.createElement('div'); overview.id='kit2-overview'; overview.className='kit2-overview';
      overview.setAttribute('role','img'); overview.setAttribute('aria-label','Обзор всех 89 регионов цветом. Для названий и деталей выберите Запад, Центр карты или Восток.');
      var clone=grid.cloneNode(true); clone.setAttribute('aria-hidden','true'); clone.removeAttribute('role'); clone.removeAttribute('aria-label');
      clone.querySelectorAll('button').forEach(function (button) { button.hidden=false; button.tabIndex=-1; button.disabled=true; button.style.gridColumn=String(Number(button.dataset.col)+1); });
      overview.append(clone);
      var caption=doc.createElement('p'); caption.className='kit2-geo-caption'; caption.textContent='Вся страна · 89 регионов. Выберите часть карты для читаемых названий и деталей.';
      overview.append(caption); host.before(overview);
    }
    var paged=val('geo')!=='panorama', band=bands[page];
    grid.style.setProperty('--kit2-cols',String(band.end-band.start+1));
    grid.setAttribute('aria-label',paged ? band.name+'. Фрагмент исходной карты. Стрелки — переход между регионами.' : '89 регионов. Панорама с горизонтальной прокруткой.');
    all.forEach(function (tile) {
      var col=Number(tile.dataset.col);
      tile.hidden=paged && (col<band.start || col>band.end);
      tile.style.gridColumn=String(col+1-(paged?band.start:0));
    });
    var visible=all.filter(function (tile) { return !tile.hidden; });
    if (!visible.some(function (tile) { return tile.tabIndex===0; })) {
      all.forEach(function(tile) { tile.tabIndex=-1; });
      if (visible[0]) visible[0].tabIndex=0;
    }
    doc.documentElement.dataset.kit2Detail=String(showingDetail);
  }
  function apply() {
    var width=val('device');
    frame.width=width;
    document.getElementById('kit2-geo-field').hidden=width!=='390';
    updateDescription();
    if (!doc) return;
    var root=doc.documentElement;
    root.dataset.density=val('density')==='spacious'?'comfortable':val('density');
    root.dataset.kit2Density=val('density');
    root.dataset.kit2Material=val('material');
    root.dataset.kit2Mobile=String(width==='390');
    root.dataset.kit2Geo=val('geo');
    root.dataset.theme=val('theme');
    root.dataset.style=val('theme');
    decorateMap();
    doc.defaultView.dispatchEvent(new Event('resize'));
  }
  frame.addEventListener('load',function () {
    if (observer) observer.disconnect();
    if (themeObserver) themeObserver.disconnect();
    doc=frame.contentDocument;
    var style=doc.createElement('link'); style.rel='stylesheet'; style.href='css/kit2-preview-frame.css?v=20261027-graphite'; doc.head.append(style);
    // Capture arrow navigation in the proposal only: hidden geographic pages
    // must not consume focus. Enter and Space retain production region details.
    doc.addEventListener('keydown',function (event) {
      var tile=event.target.closest && event.target.closest('#fm-map .dk-map__tile');
      if (!tile || val('device')!=='390' || !/^Arrow/.test(event.key)) return;
      var direction={ArrowUp:[-1,0],ArrowDown:[1,0],ArrowLeft:[0,-1],ArrowRight:[0,1]}[event.key];
      if (!direction) return;
      event.preventDefault(); event.stopImmediatePropagation();
      var best=null, distance=Infinity;
      tiles().filter(function (other) { return !other.hidden; }).forEach(function (other) {
        var dr=Number(other.dataset.row)-Number(tile.dataset.row), dc=Number(other.dataset.col)-Number(tile.dataset.col);
        if (direction[0] ? dr*direction[0]<=0 : dc*direction[1]<=0) return;
        var d=Math.abs(dr)*(direction[0]?1:3)+Math.abs(dc)*(direction[0]?3:1);
        if (d<distance) { distance=d; best=other; }
      });
      if (best) { tiles().forEach(function (other) { other.tabIndex=-1; }); best.tabIndex=0; best.focus(); }
    },true);
    var map=doc.getElementById('fm-map');
    observer=new doc.defaultView.MutationObserver(function (records) {
      // Decoration changes attributes, while production rendering replaces children.
      if (records.some(function (record) { return record.type==='childList'; })) decorateMap();
    });
    if (map) observer.observe(map,{childList:true,subtree:true});
    themeObserver=new doc.defaultView.MutationObserver(function () { form.elements.theme.value=doc.documentElement.dataset.theme; });
    themeObserver.observe(doc.documentElement,{attributes:true,attributeFilter:['data-theme']});
    apply();
  });
  form.addEventListener('change',function (event) {
    if (event.target.name==='geo') { showingDetail=false; page=0; }
    apply();
  });
  form.addEventListener('submit',function (event) { event.preventDefault(); });
  document.getElementById('kit2-top').addEventListener('click',function () { if (doc) doc.defaultView.scrollTo(0,0); });
  document.getElementById('kit2-map').addEventListener('click',function () { scrollToPart('fm-map-widget'); });
  document.getElementById('kit2-table').addEventListener('click',function () { scrollToPart('fm-table'); });
  updateDescription();
}());
