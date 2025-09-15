// Substitua a função atualizarDashboard por esta versão mais segura:
function atualizarDashboard() {
    const dadosFiltrados = aplicarFiltrosNosDados(dadosRelatorio);
    
    // Usar estatísticas da API ou calcular localmente se não disponíveis
    const estatisticas = estatisticasRelatorio.total !== undefined ? 
        estatisticasRelatorio : 
        {
            total: dadosFiltrados.length,
            ok: dadosFiltrados.filter(d => d.status === 'ok').length,
            proximo: dadosFiltrados.filter(d => d.status === 'proximo').length,
            pendente: dadosFiltrados.filter(d => d.status === 'pendente').length,
            com_erro: dadosFiltrados.filter(d => d.status === 'erro').length
        };
    
    // Atualizar contadores do dashboard - COM VERIFICAÇÃO DE NULL
    const elementsToUpdate = {
        'countTotal': estatisticas.total || 0,
        'countOk': estatisticas.ok || 0,
        'countProximo': estatisticas.proximo || 0,
        'countPendente': estatisticas.pendente || 0,
        'countErro': estatisticas.com_erro || 0
    };
    
    Object.entries(elementsToUpdate).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    });
    
    // Atualizar tabela e gráficos apenas se existirem
    const tbody = document.getElementById('corpoTabelaRelatorio');
    if (tbody) {
        atualizarTabela(dadosFiltrados);
    }
    
    if (document.getElementById('graficoMetodos')) {
        atualizarGraficos(dadosFiltrados);
    }
}