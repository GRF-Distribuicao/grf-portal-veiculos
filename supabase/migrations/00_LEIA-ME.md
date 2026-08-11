# Estado da base

As 6 tabelas do portal (`transporters`, `vehicle_registrations`, `drivers`,
`tracking_devices`, `documents`, `approval_history`) e o bucket privado
`grf-documentos` **já existem** no projeto `yxvzbcqtcfgmsptrqsfa`.
Nada aqui precisa ser rodado para o formulário público funcionar.

O único script pendente é `01_user_roles.sql`, necessário para o LOGIN e a
área `/admin`. Rode-o você mesmo no SQL Editor do Supabase — ele apenas cria
objetos novos, não altera nem apaga nada do que já existe.
