--
-- PostgreSQL database dump
--

\restrict Ayk1nRxucjEbxUpDw2D5ykmRJ2EQcf1UxTDOZYeeNbz2bzoySZ6LHCrnesLiYBC

-- Dumped from database version 18.3
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: alembic_version; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alembic_version (
    version_num character varying(32) NOT NULL
);


--
-- Name: alertas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alertas (
    id uuid NOT NULL,
    usuario_id uuid NOT NULL,
    tipo character varying(30) NOT NULL,
    referencia_id uuid,
    titulo character varying(200) NOT NULL,
    data_alerta date NOT NULL,
    visto boolean NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: contas_a_pagar; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contas_a_pagar (
    id uuid NOT NULL,
    usuario_id uuid NOT NULL,
    conta_fixa_id uuid,
    descricao character varying(150) NOT NULL,
    categoria character varying(50) NOT NULL,
    valor numeric(12,2) NOT NULL,
    data_vencimento date NOT NULL,
    status character varying(20) DEFAULT 'pendente'::character varying NOT NULL,
    tipo character varying(20) DEFAULT 'avulsa'::character varying NOT NULL,
    pago_em timestamp with time zone,
    observacao text,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: contas_a_receber; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contas_a_receber (
    id uuid NOT NULL,
    usuario_id uuid NOT NULL,
    renda_id uuid,
    descricao character varying(150) NOT NULL,
    origem character varying(30) NOT NULL,
    valor numeric(12,2) NOT NULL,
    data_prevista date NOT NULL,
    status character varying(20) DEFAULT 'pendente'::character varying NOT NULL,
    devedor character varying(150),
    recebido_em timestamp with time zone,
    observacao text,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    tipo character varying(20) DEFAULT 'avulsa'::character varying NOT NULL
);


--
-- Name: contas_fixas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contas_fixas (
    id uuid NOT NULL,
    usuario_id uuid NOT NULL,
    descricao character varying(150) NOT NULL,
    categoria character varying(50) NOT NULL,
    valor numeric(12,2) NOT NULL,
    dia_vencimento smallint NOT NULL,
    ativo boolean NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: dividas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dividas (
    id uuid NOT NULL,
    usuario_id uuid NOT NULL,
    descricao character varying(150) NOT NULL,
    credor character varying(150),
    tipo character varying(50) NOT NULL,
    valor_total numeric(12,2) NOT NULL,
    valor_parcela numeric(12,2) NOT NULL,
    parcelas_restantes smallint NOT NULL,
    taxa_juros_mensal numeric(6,4),
    data_prox_vencimento date NOT NULL,
    quitada boolean NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: planos_acao; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.planos_acao (
    id uuid NOT NULL,
    usuario_id uuid NOT NULL,
    conteudo jsonb NOT NULL,
    conteudo_texto text NOT NULL,
    estrategia character varying(20),
    data_livre_prevista date,
    feedback smallint,
    feedback_texto text,
    tokens_usados integer,
    criado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: rendas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rendas (
    id uuid NOT NULL,
    usuario_id uuid NOT NULL,
    descricao character varying(150) NOT NULL,
    valor numeric(12,2) NOT NULL,
    frequencia character varying(20) NOT NULL,
    tipo character varying(30) NOT NULL,
    ativo boolean NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: usuarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuarios (
    id uuid NOT NULL,
    nome character varying(150) NOT NULL,
    email character varying(255) NOT NULL,
    senha_hash character varying(255) NOT NULL,
    plano character varying(20) NOT NULL,
    email_verificado boolean NOT NULL,
    ativo boolean NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Data for Name: alembic_version; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.alembic_version (version_num) FROM stdin;
b3c4d5e6f7a8
\.


--
-- Data for Name: alertas; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.alertas (id, usuario_id, tipo, referencia_id, titulo, data_alerta, visto, criado_em) FROM stdin;
\.


--
-- Data for Name: contas_a_pagar; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.contas_a_pagar (id, usuario_id, conta_fixa_id, descricao, categoria, valor, data_vencimento, status, tipo, pago_em, observacao, criado_em, atualizado_em) FROM stdin;
\.


--
-- Data for Name: contas_a_receber; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.contas_a_receber (id, usuario_id, renda_id, descricao, origem, valor, data_prevista, status, devedor, recebido_em, observacao, criado_em, atualizado_em, tipo) FROM stdin;
\.


--
-- Data for Name: contas_fixas; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.contas_fixas (id, usuario_id, descricao, categoria, valor, dia_vencimento, ativo, criado_em) FROM stdin;
\.


--
-- Data for Name: dividas; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.dividas (id, usuario_id, descricao, credor, tipo, valor_total, valor_parcela, parcelas_restantes, taxa_juros_mensal, data_prox_vencimento, quitada, criado_em, atualizado_em) FROM stdin;
\.


--
-- Data for Name: planos_acao; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.planos_acao (id, usuario_id, conteudo, conteudo_texto, estrategia, data_livre_prevista, feedback, feedback_texto, tokens_usados, criado_em) FROM stdin;
\.


--
-- Data for Name: rendas; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.rendas (id, usuario_id, descricao, valor, frequencia, tipo, ativo, criado_em) FROM stdin;
\.


--
-- Data for Name: usuarios; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.usuarios (id, nome, email, senha_hash, plano, email_verificado, ativo, criado_em, atualizado_em) FROM stdin;
d4c631f2-d89f-46df-80ef-214cdb5fc411	Teste Equili	teste@equili.com	$2b$12$g.pyet0mUeFp8eafK46uIeO/3uJy/pCZDlkfCAt6YhtxbavtmAM2G	gratuito	f	t	2026-03-30 10:04:55.887806-03	2026-03-30 10:04:55.887806-03
\.


--
-- Name: alembic_version alembic_version_pkc; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alembic_version
    ADD CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num);


--
-- Name: alertas alertas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alertas
    ADD CONSTRAINT alertas_pkey PRIMARY KEY (id);


--
-- Name: contas_a_pagar contas_a_pagar_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contas_a_pagar
    ADD CONSTRAINT contas_a_pagar_pkey PRIMARY KEY (id);


--
-- Name: contas_a_receber contas_a_receber_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contas_a_receber
    ADD CONSTRAINT contas_a_receber_pkey PRIMARY KEY (id);


--
-- Name: contas_fixas contas_fixas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contas_fixas
    ADD CONSTRAINT contas_fixas_pkey PRIMARY KEY (id);


--
-- Name: dividas dividas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dividas
    ADD CONSTRAINT dividas_pkey PRIMARY KEY (id);


--
-- Name: planos_acao planos_acao_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planos_acao
    ADD CONSTRAINT planos_acao_pkey PRIMARY KEY (id);


--
-- Name: rendas rendas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rendas
    ADD CONSTRAINT rendas_pkey PRIMARY KEY (id);


--
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);


--
-- Name: ix_alertas_data_alerta; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_alertas_data_alerta ON public.alertas USING btree (data_alerta);


--
-- Name: ix_alertas_usuario_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_alertas_usuario_id ON public.alertas USING btree (usuario_id);


--
-- Name: ix_contas_a_pagar_conta_fixa_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_contas_a_pagar_conta_fixa_id ON public.contas_a_pagar USING btree (conta_fixa_id);


--
-- Name: ix_contas_a_pagar_data_vencimento; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_contas_a_pagar_data_vencimento ON public.contas_a_pagar USING btree (data_vencimento);


--
-- Name: ix_contas_a_pagar_usuario_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_contas_a_pagar_usuario_id ON public.contas_a_pagar USING btree (usuario_id);


--
-- Name: ix_contas_a_receber_data_prevista; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_contas_a_receber_data_prevista ON public.contas_a_receber USING btree (data_prevista);


--
-- Name: ix_contas_a_receber_renda_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_contas_a_receber_renda_id ON public.contas_a_receber USING btree (renda_id);


--
-- Name: ix_contas_a_receber_usuario_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_contas_a_receber_usuario_id ON public.contas_a_receber USING btree (usuario_id);


--
-- Name: ix_contas_fixas_usuario_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_contas_fixas_usuario_id ON public.contas_fixas USING btree (usuario_id);


--
-- Name: ix_dividas_usuario_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_dividas_usuario_id ON public.dividas USING btree (usuario_id);


--
-- Name: ix_planos_acao_criado_em; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_planos_acao_criado_em ON public.planos_acao USING btree (criado_em);


--
-- Name: ix_planos_acao_usuario_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_planos_acao_usuario_id ON public.planos_acao USING btree (usuario_id);


--
-- Name: ix_rendas_usuario_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_rendas_usuario_id ON public.rendas USING btree (usuario_id);


--
-- Name: ix_usuarios_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_usuarios_email ON public.usuarios USING btree (email);


--
-- Name: alertas alertas_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alertas
    ADD CONSTRAINT alertas_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: contas_a_pagar contas_a_pagar_conta_fixa_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contas_a_pagar
    ADD CONSTRAINT contas_a_pagar_conta_fixa_id_fkey FOREIGN KEY (conta_fixa_id) REFERENCES public.contas_fixas(id) ON DELETE SET NULL;


--
-- Name: contas_a_pagar contas_a_pagar_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contas_a_pagar
    ADD CONSTRAINT contas_a_pagar_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: contas_a_receber contas_a_receber_renda_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contas_a_receber
    ADD CONSTRAINT contas_a_receber_renda_id_fkey FOREIGN KEY (renda_id) REFERENCES public.rendas(id) ON DELETE SET NULL;


--
-- Name: contas_a_receber contas_a_receber_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contas_a_receber
    ADD CONSTRAINT contas_a_receber_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: contas_fixas contas_fixas_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contas_fixas
    ADD CONSTRAINT contas_fixas_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: dividas dividas_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dividas
    ADD CONSTRAINT dividas_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: planos_acao planos_acao_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planos_acao
    ADD CONSTRAINT planos_acao_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- Name: rendas rendas_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rendas
    ADD CONSTRAINT rendas_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict Ayk1nRxucjEbxUpDw2D5ykmRJ2EQcf1UxTDOZYeeNbz2bzoySZ6LHCrnesLiYBC

