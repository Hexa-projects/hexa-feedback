
INSERT INTO public.onboarding_responses (user_id, setor, funcao, unidade, tempo_casa, resumo_dia_dia, responsabilidades, ferramentas_criticas, decisores, principal_gargalo, pontos_melhoria, qualidades, whatsapp, respostas_completas)
SELECT 
  id,
  setor::text,
  COALESCE(funcao, ''),
  COALESCE(unidade, 'Hexamedical - SP'),
  tempo_casa,
  resumo_dia_dia,
  responsabilidades,
  ferramentas_criticas,
  decisores,
  principal_gargalo,
  pontos_melhoria,
  qualidades,
  whatsapp,
  jsonb_build_object(
    'setor', setor,
    'funcao', funcao,
    'unidade', unidade,
    'tempo_casa', tempo_casa,
    'resumo_dia_dia', resumo_dia_dia,
    'responsabilidades', responsabilidades,
    'ferramentas_criticas', ferramentas_criticas,
    'decisores', decisores,
    'principal_gargalo', principal_gargalo,
    'pontos_melhoria', pontos_melhoria,
    'qualidades', qualidades,
    'whatsapp', whatsapp
  )
FROM profiles
WHERE onboarding_completo = true
ON CONFLICT (user_id) DO NOTHING;
