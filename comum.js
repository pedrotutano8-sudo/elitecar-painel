/* Plataforma Liderate · painel — login, navegação e utilitários (CRM + Relatório) */
(function () {
  // Endereço e chave pública do Supabase do cliente. A chave pública não abre dado nenhum:
  // quem protege é o banco, que só responde para e-mails da lista crm.painel_usuarios.
  const CFG = window.PAINEL_CFG || {};
  const SUPABASE_URL = CFG.supabaseUrl;
  const SUPABASE_KEY = CFG.supabaseKey;
  const MARCA = CFG.nome || 'Painel';

  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const brl = (v, dec = 0) => v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: dec, maximumFractionDigits: dec });
  const brlCurto = (v) => { v = Number(v || 0); return v >= 1000 ? 'R$ ' + (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil' : brl(v); };
  const int = (v) => Number(v || 0).toLocaleString('pt-BR');
  const pct = (a, b, d = 0) => b ? (a / b * 100).toLocaleString('pt-BR', { maximumFractionDigits: d }) + '%' : '—';
  const dataHora = (s) => s ? new Date(s).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
  const data = (s) => s ? new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—';
  const fone = (t) => { const m = String(t || '').match(/^55(\d{2})(\d{4,5})(\d{4})$/); return m ? `(${m[1]}) ${m[2]}-${m[3]}` : String(t || ''); };
  const duracao = (seg) => {
    if (seg == null) return '—'; seg = Number(seg);
    if (seg < 60) return Math.round(seg) + ' s';
    if (seg < 3600) return Math.round(seg / 60) + ' min';
    return (seg / 3600).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' h';
  };

  // "R$ 1.234,56" | "689,90" | "689.90" -> número
  const valorBR = (t) => {
    const raw = String(t || '').trim().replace(/[R$\s]/g, '');
    const v = Number(raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/\.(?=\d{3}(\D|$))/g, ''));
    return isFinite(v) && v > 0 ? v : null;
  };

  const STATUS = { triagem: 'Com o bot', atendimento: 'Em atendimento', vendido: 'Vendido', perdido: 'Perdido' };
  const CANAL = { google: 'Google Ads', meta: 'Meta', site: 'Site', organico: 'WhatsApp direto' };

  // ---------- período ----------
  function periodo(chave, de, ate) {
    const n = new Date(), z = (d) => { d.setHours(0, 0, 0, 0); return d; };
    const amanha = z(new Date(n)); amanha.setDate(amanha.getDate() + 1);
    switch (chave) {
      case 'hoje': return [z(new Date(n)), amanha];
      case '7d': { const d = z(new Date(n)); d.setDate(d.getDate() - 6); return [d, amanha]; }
      case '30d': { const d = z(new Date(n)); d.setDate(d.getDate() - 29); return [d, amanha]; }
      case 'mes': return [new Date(n.getFullYear(), n.getMonth(), 1), amanha];
      case 'mesant': return [new Date(n.getFullYear(), n.getMonth() - 1, 1), new Date(n.getFullYear(), n.getMonth(), 1)];
      case 'custom': if (de && ate) { const e = new Date(ate + 'T00:00:00'); e.setDate(e.getDate() + 1); return [new Date(de + 'T00:00:00'), e]; }
      default: return [new Date(n.getFullYear(), n.getMonth(), 1), amanha];
    }
  }
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

  // ---------- armazenamento local (só conveniência) ----------
  const guarda = {
    ler: (k, p) => { try { const v = localStorage.getItem((CFG.slug || 'painel') + '.' + k); return v == null ? p : v; } catch (e) { return p; } },
    gravar: (k, v) => { try { localStorage.setItem((CFG.slug || 'painel') + '.' + k, v); } catch (e) {} }
  };

  function toast(t) {
    let el = $('#toast'); if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
    el.className = 'toast'; el.textContent = t; el.classList.remove('hidden');
    clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.add('hidden'), 2600);
  }

  // ---------- login + navegação ----------
  let sb = null;
  function telaLogin(msg) {
    document.body.innerHTML = `<section class="login"><div class="box">
      <div class="eyebrow">${esc(MARCA)}</div>
      <h1>Painel comercial</h1>
      <p>Entre com o e-mail liberado.</p>
      <form id="f-login">
        <label class="l" for="l-email">E-mail</label><input id="l-email" class="in" type="email" autocomplete="username" required>
        <label class="l" for="l-senha">Senha</label><input id="l-senha" class="in" type="password" autocomplete="current-password" required>
        <div class="erro" id="l-erro">${esc(msg || '')}</div>
        <button class="btn primary" style="width:100%;height:44px;margin-top:6px" id="l-btn">Entrar</button>
      </form></div></section>`;
    $('#f-login').addEventListener('submit', async (e) => {
      e.preventDefault(); $('#l-erro').textContent = ''; $('#l-btn').disabled = true;
      const { error } = await sb.auth.signInWithPassword({ email: $('#l-email').value.trim(), password: $('#l-senha').value });
      if (error) { $('#l-btn').disabled = false; $('#l-erro').textContent = 'E-mail ou senha incorretos.'; return; }
      location.reload();
    });
  }

  function nav(pagina, nome) {
    return `<header class="nav"><div class="wrap">
      <div class="marca"><b>${esc(MARCA)}</b><span> · ${({ crm: 'Comercial', relatorio: 'Relatório ao vivo', campanhas: 'Google Ads', ligacoes: 'Ligações' })[pagina] || ''}</span></div>
      <nav class="seg" aria-label="Seções">
        <a href="index.html" class="${pagina === 'crm' ? 'on' : ''}">CRM</a>
        <a href="ligacoes.html" class="${pagina === 'ligacoes' ? 'on' : ''}">Ligações</a>
        <a href="campanhas.html" class="${pagina === 'campanhas' ? 'on' : ''}">Campanhas</a>
        <a href="relatorio.html" class="${pagina === 'relatorio' ? 'on' : ''}">Relatório</a>
      </nav>
      <button class="sair" id="b-sair" title="${esc(nome || '')}">Sair</button>
    </div><div class="wrap barra-lojas hidden" id="barra-lojas"><span class="caption">Unidade</span><div class="seg" id="lojas" role="tablist" aria-label="Unidade"></div></div></header>`;
  }

  // ---------- unidade (loja) ----------
  // null = todas as lojas que o usuário pode ver. Guarda a escolha neste navegador.
  let lojaAtual = null, aoTrocarLoja = null;
  function montarLojas(eu) {
    const lojas = (eu && eu.lojas) || [];
    const ativas = lojas.filter(l => l.ativa);
    const salva = guarda.ler('loja', 'todas');
    lojaAtual = ativas.some(l => l.slug === salva) ? salva : (ativas.length === 1 ? ativas[0].slug : null);
    if (lojas.length < 2) return;
    const btn = (slug, nome, off) => `<button data-l="${esc(slug)}" class="${(lojaAtual || 'todas') === slug ? 'on' : ''}" ${off ? 'disabled title="Ainda não abriu"' : ''}>${esc(nome)}${off ? ' · em breve' : ''}</button>`;
    $('#lojas').innerHTML = (ativas.length > 1 ? btn('todas', 'Todas as lojas') : '') + lojas.map(l => btn(l.slug, l.nome, !l.ativa)).join('');
    $('#barra-lojas').classList.remove('hidden');
    $('#lojas').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b || b.disabled) return;
      lojaAtual = b.dataset.l === 'todas' ? null : b.dataset.l; guarda.gravar('loja', b.dataset.l);
      document.querySelectorAll('#lojas button').forEach(x => x.classList.toggle('on', x === b));
      if (aoTrocarLoja) aoTrocarLoja(lojaAtual);
    });
  }
  const loja = () => lojaAtual;
  const lojaNome = (eu) => { const l = ((eu && eu.lojas) || []).find(x => x.slug === lojaAtual); return l ? l.nome : 'Todas as lojas'; };
  const quandoTrocarLoja = (fn) => { aoTrocarLoja = fn; };

  async function iniciar(pagina, aoEntrar) {
    if (!window.supabase) { document.body.textContent = 'Não consegui carregar a biblioteca do banco. Recarregue a página.'; return; }
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return telaLogin();
    const { data: eu, error } = await sb.rpc('painel_eu');
    if (error) { await sb.auth.signOut(); return telaLogin('Esse e-mail não tem acesso ao painel.'); }
    document.body.insertAdjacentHTML('afterbegin', nav(pagina, eu && eu.nome));
    montarLojas(eu);
    $('#b-sair').onclick = async () => { await sb.auth.signOut(); location.reload(); };
    document.getElementById('app').classList.remove('hidden');
    aoEntrar(sb, eu || {});
  }

  window.Painel = { valorBR, $, esc, brl, brlCurto, int, pct, dataHora, data, fone, duracao, periodo, MESES, STATUS, CANAL, MARCA, guarda, toast, iniciar, loja, lojaNome, quandoTrocarLoja };
})();
