/* Optional DOM data visualizations; no chart engine or network dependency.
   update replaces data silently; destroy releases the owning element. */
(function () {
  'use strict';
  var esc = window.dkEsc, fmt = window.dkFmt;
  function finite(v) { return typeof v === 'number' && isFinite(v); }
  function own(el, opts, draw, cleanup) {
    if (!el) return null;
    var stopped = false, current = opts || {};
    var release = window.dkOwn(el, function () { stopped = true; if (cleanup) cleanup(); el.replaceChildren(); });
    draw(current);
    return {update: function (next) { if (!stopped) { current = next || {}; draw(current); } }, destroy: release};
  }
  function comparisonContext(options) {
    function object(value, allowed) {
      if (!value || typeof value !== 'object' || Array.isArray(value) ||
          Object.keys(value).some(function (key) { return allowed.indexOf(key) < 0; })) throw new TypeError('comparison: invalid metadata');
    }
    function day(value) {
      if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new TypeError('comparison: ISO date required');
      var time = Date.parse(value + 'T00:00:00Z');
      if (!Number.isFinite(time) || new Date(time).toISOString().slice(0,10) !== value) throw new TypeError('comparison: invalid date');
      return time;
    }
    function count(value) { return Number.isSafeInteger(value) && value >= 0; }
    function period(value) {
      object(value, ['from','to','complete','sampleSize']);
      var from = day(value.from), to = day(value.to);
      if (to < from || typeof value.complete !== 'boolean' ||
          (value.sampleSize !== undefined && !count(value.sampleSize))) throw new TypeError('comparison: invalid period');
      var after = new Date(to + 86400000).toISOString().slice(0,10);
      return {from:value.from, to:value.to, complete:value.complete, sampleSize:value.sampleSize,
        days:(to - from) / 86400000 + 1,
        calendarMonth:value.from.slice(8) === '01' && value.from.slice(0,7) === value.to.slice(0,7) && after.slice(8) === '01'};
    }
    object(options, ['currentPeriod','previousPeriod','duration','minBase','baseLabel']);
    var current = period(options.currentPeriod), previous = period(options.previousPeriod);
    var duration = options.duration === undefined ? 'equal' : options.duration;
    if (['equal','calendar-month'].indexOf(duration) < 0 ||
        (options.minBase !== undefined && (!count(options.minBase) || current.sampleSize === undefined || previous.sampleSize === undefined))) throw new TypeError('comparison: invalid policy or missing base');
    if ((current.sampleSize !== undefined || previous.sampleSize !== undefined || options.baseLabel !== undefined) &&
        (typeof options.baseLabel !== 'string' || !options.baseLabel.trim() || options.baseLabel.length > 120)) throw new TypeError('comparison: baseLabel required');
    return {current:current, previous:previous, duration:duration, minBase:options.minBase, baseLabel:options.baseLabel};
  }
  window.dkComparison = function (current, previous, better, options) {
    if (better != null && ['increase', 'decrease', 'neutral'].indexOf(better) < 0) throw new TypeError('better: increase/decrease/neutral');
    var context = options === undefined ? null : comparisonContext(options);
    var known = finite(current) && finite(previous);
    var delta = known ? current - previous : null;
    var percent = known && previous !== 0 ? delta / Math.abs(previous) * 100 : null;
    var direction = delta === null ? 'unknown' : delta > 0 ? 'increase' : delta < 0 ? 'decrease' : 'equal';
    var meaning = !known ? 'nodata' : delta === 0 || !better || better === 'neutral' ? null : direction === better ? 'calm' : 'crit';
    var result = {current: current, previous: previous, delta: delta, percent: percent, direction: direction, meaning: meaning};
    if (!context) return result;
    var code = null, status = null, reason = null;
    // Fixed precedence: missing values, incomplete periods, duration, base, overflow.
    if (!known) { code='no-data'; status='Нет данных'; reason='Для сравнения нужны оба значения; отсутствие наблюдения не равно нулю.'; }
    else if (!context.current.complete || !context.previous.complete) { code='incomplete'; status='Неполный период'; reason='Один из периодов не завершён или данные за него неполны. Сравнение отключено.'; }
    else if (context.duration === 'calendar-month' ? !context.current.calendarMonth || !context.previous.calendarMonth : context.current.days !== context.previous.days) {
      code='duration'; status='Несопоставимые периоды'; reason=context.duration === 'calendar-month' ? 'Правило метрики разрешает только два полных календарных месяца.' : 'Длительность периодов различается. Правило метрики не разрешает такое сравнение.';
    } else if (context.minBase !== undefined && (context.current.sampleSize < context.minBase || context.previous.sampleSize < context.minBase)) {
      code='base'; status='Недостаточная база'; reason='Правило этой метрики требует базу не меньше ' + context.minBase + ' (' + context.baseLabel + ') в каждом периоде.';
    } else if (!finite(delta) || (percent !== null && !finite(percent))) { code='overflow'; status='Вне диапазона'; reason='Изменение превышает числовой диапазон. Сравнение отключено.'; }
    result.context = context;
    result.comparable = !code;
    if (code) { result.delta=null; result.percent=null; result.direction='unknown'; result.meaning='nodata'; }
    if (!code && previous === 0) { code='zero-baseline'; status='Процент недоступен'; reason='Предыдущее значение равно нулю: процент изменения не определён. Абсолютное изменение доступно.'; }
    result.code=code; result.status=status; result.reason=reason;
    return result;
  };
  window.dkPeriodComparison = function (el, opts) {
    var tip = null, temporaryTab = false;
    function clearTip() { if (tip) { tip.destroy(); tip=null; } }
    function restoreTab() {
      if (!temporaryTab) return;
      temporaryTab=false; el.removeEventListener('blur',restoreTab);
      if (el.getAttribute('tabindex') === '-1') el.removeAttribute('tabindex');
    }
    return own(el, opts, function (o) {
      var d = window.dkComparison(o.current, o.previous, o.better, o.comparison);
      if (d.reason && typeof window.dkTooltip !== 'function') throw new Error('dkPeriodComparison metadata requires dk-context.js; use kit.py head period-comparison');
      var focusedButton = el.querySelector('.dk-comparison button');
      var keepFocus = focusedButton && document.activeElement === focusedButton;
      clearTip();
      var direction = {unknown:'Нет данных', increase:'Рост', decrease:'Снижение', equal:'Без изменения'}[d.direction];
      function periodText(p) {
        return p.from + '–' + p.to + (p.sampleSize === undefined ? '' : ' · База: ' + fmt.num(p.sampleSize) + ' ' + d.context.baseLabel);
      }
      el.innerHTML = '<div class="dk-comparison"><b>' + esc(o.label || 'Сравнение периодов') + '</b>' +
        '<span>Сейчас: ' + esc(fmt.num(o.current)) + (o.unit ? ' ' + esc(o.unit) : '') +
        '; ранее: ' + esc(fmt.num(o.previous)) + '</span>' +
        (d.context ? '<span>Сейчас: ' + esc(periodText(d.context.current)) + '</span><span>Ранее: ' + esc(periodText(d.context.previous)) + '</span>' : '') +
        '<span class="dk-comparison__delta">' + (d.comparable === false ? '' :
        esc(direction + ': ' + fmt.delta(d.delta) + (d.context && d.percent === null ? '' : '; ' + (d.percent === null ? 'процент не определён' : fmt.delta(d.percent, '%', 1))))) + '</span></div>';
      if (d.reason) {
        var button = document.createElement('button'); button.type='button'; button.className='dk-btn dk-btn--ghost dk-btn--sm';
        button.textContent=d.status; button.setAttribute('aria-label',d.status + ': причина');
        el.querySelector('.dk-comparison').append(button); tip=window.dkTooltip(button,{text:d.reason});
      }
      if (d.comparable === false) el.querySelector('.dk-comparison__delta').remove();
      if (d.meaning && d.comparable !== false) el.querySelector('.dk-comparison__delta').style.color = window.dkMeaning(d.meaning, 'text');
      if (keepFocus) {
        var target = el.querySelector('.dk-comparison button');
        if (!target) {
          target=el;
          if (!el.hasAttribute('tabindex')) {
            el.setAttribute('tabindex','-1'); temporaryTab=true; el.addEventListener('blur',restoreTab);
          }
        }
        target.focus({preventScroll:true});
      }
    }, function () { clearTip(); restoreTab(); });
  };
  window.dkBullet = function (el, opts) {
    return own(el, opts, function (o) {
      var min = finite(o.min) ? o.min : 0, max = finite(o.max) ? o.max : 100;
      if (max <= min) throw new RangeError('bullet: max must exceed min');
      var percent = function (v) { return Math.max(0, Math.min(100, (v - min) / (max - min) * 100)); };
      var ranges = (o.ranges || []).slice().sort(function (a,b) { return a.to - b.to; });
      if (ranges.some(function (r) { return !finite(r.to) || r.to < min || r.to > max; })) throw new RangeError('bullet: invalid range');
      var text = (o.label || 'Показатель') + ': ' + (finite(o.actual) ? fmt.num(o.actual) + (o.unit ? ' ' + o.unit : '') : 'Нет данных') +
        '; цель ' + (finite(o.target) ? fmt.num(o.target) : 'Нет данных') + '; шкала ' + fmt.num(min) + '–' + fmt.num(max);
      el.innerHTML = '<div class="dk-bullet"><div>' + esc(text) + '</div><div class="dk-bullet__track" aria-hidden="true"></div>' +
        '<p class="dk-caption">' + esc(ranges.map(function (r) { return (r.label || 'Диапазон') + ' до ' + fmt.num(r.to); }).join('; ')) + '</p></div>';
      var track = el.querySelector('.dk-bullet__track'), from = min;
      ranges.forEach(function (r, i) {
        var band = document.createElement('span');band.className='dk-bullet__range';
        band.style.left=percent(from)+'%';band.style.width=(percent(r.to)-percent(from))+'%';
        band.style.background='var(--surface-'+(i % 2 ? '3':'2')+')';track.append(band);from=r.to;
      });
      if (finite(o.actual)) {
        var actual=document.createElement('span');actual.className='dk-bullet__actual';actual.style.width=percent(o.actual)+'%';
        if(o.meaning) actual.style.background=window.dkMeaning(o.meaning,'fill');track.append(actual);
      } else track.classList.add('dk-nodata');
      if (finite(o.target)) { var target=document.createElement('span');target.className='dk-bullet__target';target.style.left=percent(o.target)+'%';track.append(target); }
    });
  };
  window.dkHeatmap = function (el, opts) {
    return own(el, opts, function (o) {
      var columns=o.columns || [], rows=o.rows || [], cuts=o.thresholds || [25,50,75];
      if(cuts.length!==3 || cuts.some(function(n,i){return !finite(n)||(i && n<=cuts[i-1]);}))throw new RangeError('heatmap: three ascending thresholds');
      var meanings=['calm','high','high','crit'];
      var legend='Ⅰ: < '+fmt.num(cuts[0])+'; Ⅱ: ≥ '+fmt.num(cuts[0])+' и < '+fmt.num(cuts[1])+'; Ⅲ: ≥ '+fmt.num(cuts[1])+' и < '+fmt.num(cuts[2])+'; Ⅳ: ≥ '+fmt.num(cuts[2])+'; штрихи: нет данных.';
      el.innerHTML='<div class="dk-heatmap"><p>'+esc(o.label || 'Распределение по времени')+'</p><p class="dk-caption">'+esc(legend)+'</p>'+
        '<div class="dk-tablewrap"><table class="dk-table dk-heatmap__table"><caption class="dk-vh">'+esc(o.label || 'Тепловая карта')+'</caption><thead><tr><th scope="col">Объект</th>'+
        columns.map(function(c){return '<th scope="col">'+esc(c)+'</th>';}).join('')+'</tr></thead><tbody>'+
        rows.map(function(r){return '<tr><th scope="row">'+esc(r.label)+'</th>'+columns.map(function(c,i){var v=(r.values||[])[i];return '<td'+(!finite(v)?' class="dk-nodata"':'')+'>'+esc(finite(v)?fmt.num(v):'Нет данных')+'</td>';}).join('')+'</tr>';}).join('')+'</tbody></table></div></div>';
      el.querySelectorAll('tbody tr').forEach(function(tr,ri){tr.querySelectorAll('td').forEach(function(td,ci){
        var v=(rows[ri].values||[])[ci];if(!finite(v))return;
        var bucket=cuts.filter(function(c){return v>=c;}).length;
        td.style.color=window.dkMeaning(meanings[bucket],'text');
        // Line count conveys the bucket without relying on hue or brightness.
        var mark=document.createElement('span');mark.className='dk-heatmap__mark';mark.textContent=['Ⅰ','Ⅱ','Ⅲ','Ⅳ'][bucket];mark.setAttribute('aria-label',' уровень '+(bucket+1));td.append(mark);
      });});
    });
  };
  window.dkTimelineAnnotations = function (el, opts) {
    return own(el, opts, function(o){
      var start=Number(new Date(o.start)),end=Number(new Date(o.end));
      if(!isFinite(start)||!isFinite(end)||end<=start)throw new RangeError('timeline: invalid interval');
      var events=(o.events||[]).map(function(e){var a=Number(new Date(e.start)),b=e.end==null?a:Number(new Date(e.end));if(!isFinite(a)||!isFinite(b)||b<a)throw new RangeError('timeline: invalid event');return {label:e.label,start:a,end:b};}).sort(function(a,b){return a.start-b.start;});
      // A row per label deliberately avoids collision at any font size.
      el.innerHTML='<div class="dk-annotations"><p>'+esc(o.label||'События на временной шкале')+'</p><ol>'+events.map(function(e){
        return '<li><span>'+esc(e.label)+' · '+esc(fmt.dateTime(e.start))+(e.end!==e.start?' – '+esc(fmt.dateTime(e.end)):'')+'</span><span class="dk-annotations__track" aria-hidden="true"><i></i></span></li>';
      }).join('')+'</ol>'+(events.length?'':'<p class="dk-caption">Событий за период нет</p>')+'</div>';
      el.querySelectorAll('li').forEach(function(li,i){var e=events[i],mark=li.querySelector('i');var a=Math.max(0,Math.min(100,(e.start-start)/(end-start)*100));var b=Math.max(0,Math.min(100,(e.end-start)/(end-start)*100));mark.style.left=a+'%';mark.style.width=Math.max(1,b-a)+'%';});
    });
  };
})();
