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
      <div class="marca"><b>${esc(MARCA)}</b><span> · ${pagina === 'crm' ? 'Comercial' : 'Relatório ao vivo'}</span></div>
      <nav class="seg" aria-label="Seções">
        <a href="index.html" class="${pagina === 'crm' ? 'on' : ''}">CRM</a>
        <a href="relatorio.html" class="${pagina === 'relatorio' ? 'on' : ''}">Relatório</a>
      </nav>
      <button class="sair" id="b-sair" title="${esc(nome || '')}">Sair</button>
    </div></header>`;
  }

  async function iniciar(pagina, aoEntrar) {
    if (!window.supabase) { document.body.textContent = 'Não consegui carregar a biblioteca do banco. Recarregue a página.'; return; }
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return telaLogin();
    const { data: eu, error } = await sb.rpc('painel_eu');
    if (error) { await sb.auth.signOut(); return telaLogin('Esse e-mail não tem acesso ao painel.'); }
    document.body.insertAdjacentHTML('afterbegin', nav(pagina, eu && eu.nome));
    $('#b-sair').onclick = async () => { await sb.auth.signOut(); location.reload(); };
    document.getElementById('app').classList.remove('hidden');
    aoEntrar(sb, eu || {});
  }

  window.Painel = { $, esc, brl, brlCurto, int, pct, dataHora, data, fone, duracao, periodo, MESES, STATUS, CANAL, MARCA, guarda, toast, iniciar };
})();
