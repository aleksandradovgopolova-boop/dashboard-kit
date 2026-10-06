/* Optional DOM data visualizations; no chart engine or network dependency.
   update replaces data silently; destroy releases the owning element. */
(function () {
  'use strict';
  var esc = window.dkEsc, fmt = window.dkFmt;
  function finite(v) { return typeof v === 'number' && isFinite(v); }
  function own(el, opts, draw) {
    if (!el) return null;
    var stopped = false, current = opts || {};
    var release = window.dkOwn(el, function () { stopped = true; el.replaceChildren(); });
    draw(current);
    return {update: function (next) { if (!stopped) { current = next || {}; draw(current); } }, destroy: release};
  }
  window.dkComparison = function (current, previous, better) {
    if (better != null && ['increase', 'decrease', 'neutral'].indexOf(better) < 0) throw new TypeError('better: increase/decrease/neutral');
    var known = finite(current) && finite(previous);
    var delta = known ? current - previous : null;
    var percent = known && previous !== 0 ? delta / Math.abs(previous) * 100 : null;
    var direction = delta === null ? 'unknown' : delta > 0 ? 'increase' : delta < 0 ? 'decrease' : 'equal';
    var meaning = !known ? 'nodata' : delta === 0 || !better || better === 'neutral' ? null : direction === better ? 'calm' : 'crit';
    return {current: current, previous: previous, delta: delta, percent: percent, direction: direction, meaning: meaning};
  };
  window.dkPeriodComparison = function (el, opts) {
    return own(el, opts, function (o) {
      var d = window.dkComparison(o.current, o.previous, o.better);
      var direction = {unknown:'Нет данных', increase:'Рост', decrease:'Снижение', equal:'Без изменения'}[d.direction];
      el.innerHTML = '<div class="dk-comparison"><b>' + esc(o.label || 'Сравнение периодов') + '</b>' +
        '<span>Сейчас: ' + esc(fmt.num(o.current)) + (o.unit ? ' ' + esc(o.unit) : '') +
        '; ранее: ' + esc(fmt.num(o.previous)) + '</span><span class="dk-comparison__delta">' +
        esc(direction + ': ' + fmt.delta(d.delta) + '; ' + (d.percent === null ? 'процент не определён' : fmt.delta(d.percent, '%', 1))) + '</span></div>';
      if (d.meaning) el.querySelector('.dk-comparison__delta').style.color = window.dkMeaning(d.meaning, 'text');
    });
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
