--
-- PostgreSQL database dump
--

\restrict odHGGFmuM8nLQsrAbEGQdbJRONU9HssbIMD9wCB4s8qIyxeZ5AmyJY7I8O4CXHn

-- Dumped from database version 16.10 (Ubuntu 16.10-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.10 (Ubuntu 16.10-0ubuntu0.24.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_location_id_fkey;
ALTER TABLE IF EXISTS ONLY public.transactions DROP CONSTRAINT IF EXISTS transactions_seller_address_fkey;
ALTER TABLE IF EXISTS ONLY public.transactions DROP CONSTRAINT IF EXISTS transactions_order_id_fkey;
ALTER TABLE IF EXISTS ONLY public.transactions DROP CONSTRAINT IF EXISTS transactions_buyer_address_fkey;
ALTER TABLE IF EXISTS ONLY public.reviews DROP CONSTRAINT IF EXISTS reviews_reviewer_address_fkey;
ALTER TABLE IF EXISTS ONLY public.reviews DROP CONSTRAINT IF EXISTS reviews_reviewee_address_fkey;
ALTER TABLE IF EXISTS ONLY public.reviews DROP CONSTRAINT IF EXISTS reviews_order_id_fkey;
ALTER TABLE IF EXISTS ONLY public.reviews DROP CONSTRAINT IF EXISTS reviews_approved_by_fkey;
ALTER TABLE IF EXISTS ONLY public.payment_confirmations DROP CONSTRAINT IF EXISTS payment_confirmations_order_id_fkey;
ALTER TABLE IF EXISTS ONLY public.otp_logs DROP CONSTRAINT IF EXISTS otp_logs_order_id_fkey;
ALTER TABLE IF EXISTS ONLY public.orders DROP CONSTRAINT IF EXISTS orders_seller_address_fkey;
ALTER TABLE IF EXISTS ONLY public.orders DROP CONSTRAINT IF EXISTS orders_payment_confirmation_id_fkey;
ALTER TABLE IF EXISTS ONLY public.orders DROP CONSTRAINT IF EXISTS orders_dispute_id_fkey;
ALTER TABLE IF EXISTS ONLY public.orders DROP CONSTRAINT IF EXISTS orders_buyer_address_fkey;
ALTER TABLE IF EXISTS ONLY public.orders DROP CONSTRAINT IF EXISTS orders_ad_id_fkey;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS fk_users_location;
ALTER TABLE IF EXISTS ONLY public.transactions DROP CONSTRAINT IF EXISTS fk_transactions_seller;
ALTER TABLE IF EXISTS ONLY public.transactions DROP CONSTRAINT IF EXISTS fk_transactions_order;
ALTER TABLE IF EXISTS ONLY public.transactions DROP CONSTRAINT IF EXISTS fk_transactions_buyer;
ALTER TABLE IF EXISTS ONLY public.reviews DROP CONSTRAINT IF EXISTS fk_reviews_reviewer;
ALTER TABLE IF EXISTS ONLY public.reviews DROP CONSTRAINT IF EXISTS fk_reviews_reviewee;
ALTER TABLE IF EXISTS ONLY public.reviews DROP CONSTRAINT IF EXISTS fk_reviews_order;
ALTER TABLE IF EXISTS ONLY public.reviews DROP CONSTRAINT IF EXISTS fk_reviews_approved_by;
ALTER TABLE IF EXISTS ONLY public.payment_confirmations DROP CONSTRAINT IF EXISTS fk_payment_confirmations_order;
ALTER TABLE IF EXISTS ONLY public.otp_logs DROP CONSTRAINT IF EXISTS fk_otp_logs_order;
ALTER TABLE IF EXISTS ONLY public.orders DROP CONSTRAINT IF EXISTS fk_orders_seller;
ALTER TABLE IF EXISTS ONLY public.orders DROP CONSTRAINT IF EXISTS fk_orders_buyer;
ALTER TABLE IF EXISTS ONLY public.orders DROP CONSTRAINT IF EXISTS fk_orders_ad;
ALTER TABLE IF EXISTS ONLY public.agents DROP CONSTRAINT IF EXISTS fk_agents_location;
ALTER TABLE IF EXISTS ONLY public.ads DROP CONSTRAINT IF EXISTS fk_ads_location;
ALTER TABLE IF EXISTS ONLY public.disputes DROP CONSTRAINT IF EXISTS disputes_order_id_fkey;
ALTER TABLE IF EXISTS ONLY public.dispute_timeline DROP CONSTRAINT IF EXISTS dispute_timeline_order_id_fkey;
ALTER TABLE IF EXISTS ONLY public.dispute_timeline DROP CONSTRAINT IF EXISTS dispute_timeline_dispute_id_fkey;
ALTER TABLE IF EXISTS ONLY public.calls DROP CONSTRAINT IF EXISTS calls_receiver_address_fkey;
ALTER TABLE IF EXISTS ONLY public.calls DROP CONSTRAINT IF EXISTS calls_caller_address_fkey;
ALTER TABLE IF EXISTS ONLY public.appeals DROP CONSTRAINT IF EXISTS appeals_order_id_fkey;
ALTER TABLE IF EXISTS ONLY public.appeals DROP CONSTRAINT IF EXISTS appeals_dispute_id_fkey;
ALTER TABLE IF EXISTS ONLY public.agents DROP CONSTRAINT IF EXISTS agents_location_id_fkey;
ALTER TABLE IF EXISTS ONLY public.ads DROP CONSTRAINT IF EXISTS ads_owner_selected_agent_id_fkey;
ALTER TABLE IF EXISTS ONLY public.ads DROP CONSTRAINT IF EXISTS ads_owner_address_fkey;
ALTER TABLE IF EXISTS ONLY public.ads DROP CONSTRAINT IF EXISTS ads_location_id_fkey;
ALTER TABLE IF EXISTS ONLY public.admin_notifications DROP CONSTRAINT IF EXISTS admin_notifications_order_id_fkey;
ALTER TABLE IF EXISTS ONLY public.admin_notifications DROP CONSTRAINT IF EXISTS admin_notifications_dispute_id_fkey;
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
DROP TRIGGER IF EXISTS update_support_updated_at ON public.support;
DROP TRIGGER IF EXISTS update_app_settings_updated_at ON public.app_settings;
DROP INDEX IF EXISTS public.idx_users_verified;
DROP INDEX IF EXISTS public.idx_users_location;
DROP INDEX IF EXISTS public.idx_users_address;
DROP INDEX IF EXISTS public.idx_tx_order;
DROP INDEX IF EXISTS public.idx_transactions_seller;
DROP INDEX IF EXISTS public.idx_transactions_order;
DROP INDEX IF EXISTS public.idx_transactions_number;
DROP INDEX IF EXISTS public.idx_transactions_buyer;
DROP INDEX IF EXISTS public.idx_support_active;
DROP INDEX IF EXISTS public.idx_reviews_visible;
DROP INDEX IF EXISTS public.idx_reviews_reviewer;
DROP INDEX IF EXISTS public.idx_reviews_reviewee;
DROP INDEX IF EXISTS public.idx_reviews_rating;
DROP INDEX IF EXISTS public.idx_reviews_order_id_null;
DROP INDEX IF EXISTS public.idx_reviews_order;
DROP INDEX IF EXISTS public.idx_reviews_created_at;
DROP INDEX IF EXISTS public.idx_reviews_approved;
DROP INDEX IF EXISTS public.idx_payment_confirmations_order_id;
DROP INDEX IF EXISTS public.idx_otp_user;
DROP INDEX IF EXISTS public.idx_otp_logs_order;
DROP INDEX IF EXISTS public.idx_otp_expires;
DROP INDEX IF EXISTS public.idx_orders_state;
DROP INDEX IF EXISTS public.idx_orders_start_time;
DROP INDEX IF EXISTS public.idx_orders_seller;
DROP INDEX IF EXISTS public.idx_orders_created_at;
DROP INDEX IF EXISTS public.idx_orders_buyer;
DROP INDEX IF EXISTS public.idx_orders_blockchain_trade_id;
DROP INDEX IF EXISTS public.idx_orders_ad;
DROP INDEX IF EXISTS public.idx_disputes_status;
DROP INDEX IF EXISTS public.idx_disputes_order_id;
DROP INDEX IF EXISTS public.idx_dispute_timeline_order_id;
DROP INDEX IF EXISTS public.idx_dispute_timeline_dispute_id;
DROP INDEX IF EXISTS public.idx_calls_participants;
DROP INDEX IF EXISTS public.idx_calls_caller;
DROP INDEX IF EXISTS public.idx_audit_user;
DROP INDEX IF EXISTS public.idx_audit_logs_user;
DROP INDEX IF EXISTS public.idx_audit_details;
DROP INDEX IF EXISTS public.idx_audit_created;
DROP INDEX IF EXISTS public.idx_audit_action;
DROP INDEX IF EXISTS public.idx_appeals_order_id;
DROP INDEX IF EXISTS public.idx_appeals_dispute_id;
DROP INDEX IF EXISTS public.idx_appeals_appellant;
DROP INDEX IF EXISTS public.idx_agents_verified;
DROP INDEX IF EXISTS public.idx_agents_location;
DROP INDEX IF EXISTS public.idx_agents_city;
DROP INDEX IF EXISTS public.idx_ads_type;
DROP INDEX IF EXISTS public.idx_ads_token;
DROP INDEX IF EXISTS public.idx_ads_owner_agent;
DROP INDEX IF EXISTS public.idx_ads_owner;
DROP INDEX IF EXISTS public.idx_ads_location;
DROP INDEX IF EXISTS public.idx_ads_city;
DROP INDEX IF EXISTS public.idx_ads_active_city;
DROP INDEX IF EXISTS public.idx_ads_active;
DROP INDEX IF EXISTS public.idx_admin_notifications_status;
DROP INDEX IF EXISTS public.idx_admin_notifications_dispute_id;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_pkey;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_address_key;
ALTER TABLE IF EXISTS ONLY public.transactions DROP CONSTRAINT IF EXISTS transactions_transaction_number_key;
ALTER TABLE IF EXISTS ONLY public.transactions DROP CONSTRAINT IF EXISTS transactions_pkey;
ALTER TABLE IF EXISTS ONLY public.support DROP CONSTRAINT IF EXISTS support_pkey;
ALTER TABLE IF EXISTS ONLY public.reviews DROP CONSTRAINT IF EXISTS reviews_pkey;
ALTER TABLE IF EXISTS ONLY public.payment_confirmations DROP CONSTRAINT IF EXISTS payment_confirmations_pkey;
ALTER TABLE IF EXISTS ONLY public.payment_confirmations DROP CONSTRAINT IF EXISTS payment_confirmations_order_id_unique;
ALTER TABLE IF EXISTS ONLY public.otp_logs DROP CONSTRAINT IF EXISTS otp_logs_pkey;
ALTER TABLE IF EXISTS ONLY public.orders DROP CONSTRAINT IF EXISTS orders_pkey;
ALTER TABLE IF EXISTS ONLY public.locations DROP CONSTRAINT IF EXISTS locations_pkey;
ALTER TABLE IF EXISTS ONLY public.locations DROP CONSTRAINT IF EXISTS locations_name_key;
ALTER TABLE IF EXISTS ONLY public.disputes DROP CONSTRAINT IF EXISTS disputes_pkey;
ALTER TABLE IF EXISTS ONLY public.dispute_timeline DROP CONSTRAINT IF EXISTS dispute_timeline_pkey;
ALTER TABLE IF EXISTS ONLY public.calls DROP CONSTRAINT IF EXISTS calls_pkey;
ALTER TABLE IF EXISTS ONLY public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_pkey;
ALTER TABLE IF EXISTS ONLY public.appeals DROP CONSTRAINT IF EXISTS appeals_pkey;
ALTER TABLE IF EXISTS ONLY public.app_settings DROP CONSTRAINT IF EXISTS app_settings_pkey;
ALTER TABLE IF EXISTS ONLY public.app_settings DROP CONSTRAINT IF EXISTS app_settings_key_key;
ALTER TABLE IF EXISTS ONLY public.agents DROP CONSTRAINT IF EXISTS agents_pkey;
ALTER TABLE IF EXISTS ONLY public.ads DROP CONSTRAINT IF EXISTS ads_pkey;
ALTER TABLE IF EXISTS ONLY public.admin_users DROP CONSTRAINT IF EXISTS admin_users_username_key;
ALTER TABLE IF EXISTS ONLY public.admin_users DROP CONSTRAINT IF EXISTS admin_users_pkey;
ALTER TABLE IF EXISTS ONLY public.admin_notifications DROP CONSTRAINT IF EXISTS admin_notifications_pkey;
ALTER TABLE IF EXISTS public.users ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.transactions ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.support ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.reviews ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.payment_confirmations ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.otp_logs ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.orders ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.locations ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.disputes ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.dispute_timeline ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.calls ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.audit_logs ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.appeals ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.app_settings ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.agents ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.ads ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.admin_users ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.admin_notifications ALTER COLUMN id DROP DEFAULT;
DROP SEQUENCE IF EXISTS public.users_id_seq;
DROP TABLE IF EXISTS public.users;
DROP SEQUENCE IF EXISTS public.transactions_id_seq;
DROP TABLE IF EXISTS public.transactions;
DROP SEQUENCE IF EXISTS public.support_id_seq;
DROP TABLE IF EXISTS public.support;
DROP SEQUENCE IF EXISTS public.reviews_id_seq;
DROP TABLE IF EXISTS public.reviews;
DROP SEQUENCE IF EXISTS public.payment_confirmations_id_seq;
DROP TABLE IF EXISTS public.payment_confirmations;
DROP SEQUENCE IF EXISTS public.otp_logs_id_seq;
DROP TABLE IF EXISTS public.otp_logs;
DROP SEQUENCE IF EXISTS public.orders_id_seq;
DROP TABLE IF EXISTS public.orders;
DROP SEQUENCE IF EXISTS public.locations_id_seq;
DROP TABLE IF EXISTS public.locations;
DROP SEQUENCE IF EXISTS public.disputes_id_seq;
DROP TABLE IF EXISTS public.disputes;
DROP SEQUENCE IF EXISTS public.dispute_timeline_id_seq;
DROP TABLE IF EXISTS public.dispute_timeline;
DROP SEQUENCE IF EXISTS public.calls_id_seq;
DROP TABLE IF EXISTS public.calls;
DROP SEQUENCE IF EXISTS public.audit_logs_id_seq;
DROP TABLE IF EXISTS public.audit_logs;
DROP SEQUENCE IF EXISTS public.appeals_id_seq;
DROP TABLE IF EXISTS public.appeals;
DROP SEQUENCE IF EXISTS public.app_settings_id_seq;
DROP TABLE IF EXISTS public.app_settings;
DROP SEQUENCE IF EXISTS public.agents_id_seq;
DROP TABLE IF EXISTS public.agents;
DROP SEQUENCE IF EXISTS public.ads_id_seq;
DROP TABLE IF EXISTS public.ads;
DROP SEQUENCE IF EXISTS public.admin_users_id_seq;
DROP TABLE IF EXISTS public.admin_users;
DROP SEQUENCE IF EXISTS public.admin_notifications_id_seq;
DROP TABLE IF EXISTS public.admin_notifications;
DROP FUNCTION IF EXISTS public.update_updated_at_column();
--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admin_notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.admin_notifications (
    id integer NOT NULL,
    dispute_id integer NOT NULL,
    order_id integer NOT NULL,
    notification_type character varying(30) NOT NULL,
    title character varying(255) NOT NULL,
    message text NOT NULL,
    priority character varying(10) DEFAULT 'MEDIUM'::character varying,
    status character varying(20) DEFAULT 'UNREAD'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    read_at timestamp without time zone,
    acted_at timestamp without time zone,
    CONSTRAINT admin_notifications_priority_check CHECK (((priority)::text = ANY ((ARRAY['LOW'::character varying, 'MEDIUM'::character varying, 'HIGH'::character varying, 'URGENT'::character varying])::text[]))),
    CONSTRAINT admin_notifications_status_check CHECK (((status)::text = ANY ((ARRAY['UNREAD'::character varying, 'READ'::character varying, 'ACTED_UPON'::character varying])::text[])))
);


ALTER TABLE public.admin_notifications OWNER TO postgres;

--
-- Name: TABLE admin_notifications; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.admin_notifications IS 'Notifications for admin dashboard';


--
-- Name: COLUMN admin_notifications.priority; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.admin_notifications.priority IS 'Priority level for admin attention';


--
-- Name: admin_notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.admin_notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.admin_notifications_id_seq OWNER TO postgres;

--
-- Name: admin_notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.admin_notifications_id_seq OWNED BY public.admin_notifications.id;


--
-- Name: admin_users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.admin_users (
    id integer NOT NULL,
    username character varying(50) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role character varying(20) DEFAULT 'admin'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.admin_users OWNER TO postgres;

--
-- Name: TABLE admin_users; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.admin_users IS 'Admin panel users';


--
-- Name: COLUMN admin_users.password_hash; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.admin_users.password_hash IS 'Bcrypt hashed password';


--
-- Name: COLUMN admin_users.role; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.admin_users.role IS 'SUPER_ADMIN, ADMIN, SUPPORT, etc.';


--
-- Name: admin_users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.admin_users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.admin_users_id_seq OWNER TO postgres;

--
-- Name: admin_users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.admin_users_id_seq OWNED BY public.admin_users.id;


--
-- Name: ads; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ads (
    id integer NOT NULL,
    owner_address character varying(42) NOT NULL,
    owner_selected_agent_id bigint,
    type character varying(10) NOT NULL,
    token character varying(10) NOT NULL,
    price_inr numeric(15,2) NOT NULL,
    min_amount numeric(18,6) NOT NULL,
    max_amount numeric(18,6) NOT NULL,
    lock_duration_seconds integer DEFAULT 3600,
    city character varying(100),
    active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    location_id integer,
    sell_quantity numeric(18,6),
    buy_quantity numeric(18,6),
    CONSTRAINT ads_token_check CHECK (((token)::text = ANY ((ARRAY['TBNB'::character varying, 'USDT'::character varying, 'USDC'::character varying])::text[]))),
    CONSTRAINT ads_type_check CHECK (((type)::text = ANY ((ARRAY['BUY'::character varying, 'SELL'::character varying])::text[])))
);


ALTER TABLE public.ads OWNER TO postgres;

--
-- Name: TABLE ads; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.ads IS 'P2P trading advertisements';


--
-- Name: COLUMN ads.type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.ads.type IS 'BUY or SELL advertisement';


--
-- Name: COLUMN ads.token; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.ads.token IS 'Cryptocurrency token type';


--
-- Name: COLUMN ads.price_inr; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.ads.price_inr IS 'Price per token in INR';


--
-- Name: COLUMN ads.lock_duration_seconds; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.ads.lock_duration_seconds IS 'How long buyer has to pay';


--
-- Name: COLUMN ads.location_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.ads.location_id IS 'Preferred location for this ad';


--
-- Name: COLUMN ads.sell_quantity; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.ads.sell_quantity IS 'Total quantity available to sell (for SELL ads)';


--
-- Name: COLUMN ads.buy_quantity; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.ads.buy_quantity IS 'Total quantity willing to buy (for BUY ads)';


--
-- Name: ads_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ads_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ads_id_seq OWNER TO postgres;

--
-- Name: ads_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ads_id_seq OWNED BY public.ads.id;


--
-- Name: agents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.agents (
    id integer NOT NULL,
    branch_name character varying(255) NOT NULL,
    city character varying(100) NOT NULL,
    address character varying(500),
    mobile character varying(20),
    verified boolean DEFAULT false,
    created_by_admin integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    location_id integer
);


ALTER TABLE public.agents OWNER TO postgres;

--
-- Name: TABLE agents; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.agents IS 'Agent branches for cash exchange';


--
-- Name: COLUMN agents.branch_name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.agents.branch_name IS 'Branch/agency name';


--
-- Name: COLUMN agents.verified; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.agents.verified IS 'Admin verified agent';


--
-- Name: COLUMN agents.created_by_admin; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.agents.created_by_admin IS 'Admin wallet address who created this';


--
-- Name: COLUMN agents.location_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.agents.location_id IS 'Reference to location';


--
-- Name: agents_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.agents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.agents_id_seq OWNER TO postgres;

--
-- Name: agents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.agents_id_seq OWNED BY public.agents.id;


--
-- Name: app_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.app_settings (
    id integer NOT NULL,
    key character varying(100) NOT NULL,
    value text,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_by integer
);


ALTER TABLE public.app_settings OWNER TO postgres;

--
-- Name: TABLE app_settings; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.app_settings IS 'Application configuration settings';


--
-- Name: COLUMN app_settings.key; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.app_settings.key IS 'Unique setting key';


--
-- Name: COLUMN app_settings.value; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.app_settings.value IS 'Setting value (can be JSON)';


--
-- Name: app_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.app_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.app_settings_id_seq OWNER TO postgres;

--
-- Name: app_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.app_settings_id_seq OWNED BY public.app_settings.id;


--
-- Name: appeals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.appeals (
    id integer NOT NULL,
    dispute_id integer NOT NULL,
    order_id integer NOT NULL,
    appellant_address character varying(42) NOT NULL,
    appellant_type character varying(10) NOT NULL,
    description text NOT NULL,
    evidence_video_url text,
    evidence_screenshots text[],
    evidence_documents text[],
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    status character varying(20) DEFAULT 'PENDING'::character varying,
    CONSTRAINT appeals_appellant_type_check CHECK (((appellant_type)::text = ANY ((ARRAY['BUYER'::character varying, 'SELLER'::character varying])::text[]))),
    CONSTRAINT appeals_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'REVIEWED'::character varying, 'ACCEPTED'::character varying, 'REJECTED'::character varying])::text[])))
);


ALTER TABLE public.appeals OWNER TO postgres;

--
-- Name: TABLE appeals; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.appeals IS 'Individual appeals filed by buyers or sellers';


--
-- Name: COLUMN appeals.appellant_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.appeals.appellant_type IS 'Whether the appeal was filed by buyer or seller';


--
-- Name: COLUMN appeals.evidence_video_url; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.appeals.evidence_video_url IS 'URL to video evidence uploaded by appellant';


--
-- Name: appeals_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.appeals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.appeals_id_seq OWNER TO postgres;

--
-- Name: appeals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.appeals_id_seq OWNED BY public.appeals.id;


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_logs (
    id integer NOT NULL,
    user_address character varying(42),
    action character varying(100) NOT NULL,
    resource_type character varying(50),
    resource_id character varying(50),
    details jsonb,
    ip_address inet,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.audit_logs OWNER TO postgres;

--
-- Name: TABLE audit_logs; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.audit_logs IS 'Activity audit trail';


--
-- Name: COLUMN audit_logs.action; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.audit_logs.action IS 'Action performed (e.g., CREATE_ORDER, CANCEL_ORDER)';


--
-- Name: COLUMN audit_logs.details; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.audit_logs.details IS 'Additional context in JSON format';


--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.audit_logs_id_seq OWNER TO postgres;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: calls; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.calls (
    id integer NOT NULL,
    caller_address character varying(42) NOT NULL,
    receiver_address character varying(42) NOT NULL,
    status character varying(20) DEFAULT 'initiated'::character varying,
    signaling_data jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    ended_at timestamp without time zone,
    CONSTRAINT calls_status_check CHECK (((status)::text = ANY ((ARRAY['initiated'::character varying, 'active'::character varying, 'ended'::character varying, 'failed'::character varying])::text[])))
);


ALTER TABLE public.calls OWNER TO postgres;

--
-- Name: TABLE calls; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.calls IS 'WebRTC call records';


--
-- Name: COLUMN calls.status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.calls.status IS 'INITIATED, CONNECTED, ENDED, FAILED';


--
-- Name: calls_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.calls_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.calls_id_seq OWNER TO postgres;

--
-- Name: calls_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.calls_id_seq OWNED BY public.calls.id;


--
-- Name: dispute_timeline; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.dispute_timeline (
    id integer NOT NULL,
    dispute_id integer,
    order_id integer NOT NULL,
    event_type character varying(30) NOT NULL,
    event_description text NOT NULL,
    created_by character varying(42),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    metadata jsonb
);


ALTER TABLE public.dispute_timeline OWNER TO postgres;

--
-- Name: TABLE dispute_timeline; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.dispute_timeline IS 'Audit trail of all dispute-related events';


--
-- Name: COLUMN dispute_timeline.event_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.dispute_timeline.event_type IS 'Type of event: APPEAL_FILED, ADMIN_REVIEW, RESOLUTION, etc.';


--
-- Name: dispute_timeline_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.dispute_timeline_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.dispute_timeline_id_seq OWNER TO postgres;

--
-- Name: dispute_timeline_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.dispute_timeline_id_seq OWNED BY public.dispute_timeline.id;


--
-- Name: disputes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.disputes (
    id integer NOT NULL,
    order_id integer NOT NULL,
    dispute_type character varying(20) NOT NULL,
    status character varying(20) DEFAULT 'PENDING'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    resolved_at timestamp without time zone,
    resolved_by character varying(42),
    resolution character varying(20),
    resolution_reason text,
    created_by character varying(42) NOT NULL,
    CONSTRAINT disputes_dispute_type_check CHECK (((dispute_type)::text = ANY ((ARRAY['PAYMENT_NOT_RECEIVED'::character varying, 'PAYMENT_NOT_SENT'::character varying, 'OTHER'::character varying])::text[]))),
    CONSTRAINT disputes_resolution_check CHECK (((resolution)::text = ANY ((ARRAY['TRANSFER_TO_BUYER'::character varying, 'REFUND_TO_SELLER'::character varying, 'SPLIT_REFUND'::character varying])::text[]))),
    CONSTRAINT disputes_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'UNDER_REVIEW'::character varying, 'RESOLVED'::character varying, 'CLOSED'::character varying])::text[])))
);


ALTER TABLE public.disputes OWNER TO postgres;

--
-- Name: TABLE disputes; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.disputes IS 'Main disputes table for tracking dispute resolution process';


--
-- Name: COLUMN disputes.dispute_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.disputes.dispute_type IS 'Type of dispute: payment not received, payment not sent, or other';


--
-- Name: COLUMN disputes.resolution; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.disputes.resolution IS 'Final resolution: transfer to buyer, refund to seller, or split refund';


--
-- Name: disputes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.disputes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.disputes_id_seq OWNER TO postgres;

--
-- Name: disputes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.disputes_id_seq OWNED BY public.disputes.id;


--
-- Name: locations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.locations (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    city character varying(255),
    state character varying(255),
    country character varying(255) DEFAULT 'India'::character varying,
    active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.locations OWNER TO postgres;

--
-- Name: TABLE locations; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.locations IS 'Master table for cities and locations';


--
-- Name: COLUMN locations.name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.locations.name IS 'Unique location name (e.g., Mumbai)';


--
-- Name: COLUMN locations.city; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.locations.city IS 'City name';


--
-- Name: COLUMN locations.state; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.locations.state IS 'State name';


--
-- Name: locations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.locations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.locations_id_seq OWNER TO postgres;

--
-- Name: locations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.locations_id_seq OWNED BY public.locations.id;


--
-- Name: orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.orders (
    id integer NOT NULL,
    ad_id integer NOT NULL,
    buyer_address character varying(42) NOT NULL,
    seller_address character varying(42) NOT NULL,
    amount numeric(18,6) NOT NULL,
    token character varying(10) NOT NULL,
    state character varying(20) DEFAULT 'CREATED'::character varying,
    agent_branch character varying(255),
    agent_number character varying(20),
    agent_address character varying(500),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    accepted_at timestamp without time zone,
    lock_expires_at timestamp without time zone,
    tx_hash character varying(66),
    start_time timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    timezone character varying(100),
    start_datetime_string character varying(100),
    otp_hash character varying(66),
    blockchain_trade_id integer,
    create_trade_tx_hash character varying(66),
    payment_confirmation_id integer,
    dispute_id integer,
    appeal_deadline timestamp without time zone,
    resolution_deadline timestamp without time zone,
    CONSTRAINT orders_state_check CHECK (((state)::text = ANY ((ARRAY['CREATED'::character varying, 'ACCEPTED'::character varying, 'LOCKED'::character varying, 'RELEASED'::character varying, 'CANCELLED'::character varying, 'EXPIRED'::character varying, 'DISPUTED'::character varying, 'UNDER_DISPUTE'::character varying, 'UNDER_REVIEW'::character varying, 'APPEALED'::character varying, 'RESOLVED'::character varying, 'CONFIRMED'::character varying, 'REFUNDED'::character varying])::text[])))
);


ALTER TABLE public.orders OWNER TO postgres;

--
-- Name: TABLE orders; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.orders IS 'Trading orders with 5-minute countdown';


--
-- Name: COLUMN orders.state; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.orders.state IS 'Order workflow state';


--
-- Name: COLUMN orders.lock_expires_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.orders.lock_expires_at IS 'When payment window expires';


--
-- Name: COLUMN orders.tx_hash; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.orders.tx_hash IS 'Blockchain transaction hash';


--
-- Name: COLUMN orders.start_time; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.orders.start_time IS 'UTC timestamp when order was created (for countdown)';


--
-- Name: COLUMN orders.timezone; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.orders.timezone IS 'User timezone (e.g., Asia/Calcutta)';


--
-- Name: COLUMN orders.start_datetime_string; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.orders.start_datetime_string IS 'Formatted display time with timezone';


--
-- Name: COLUMN orders.otp_hash; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.orders.otp_hash IS 'Hashed OTP for payment confirmation';


--
-- Name: orders_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.orders_id_seq OWNER TO postgres;

--
-- Name: orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.orders_id_seq OWNED BY public.orders.id;


--
-- Name: otp_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.otp_logs (
    id integer NOT NULL,
    user_address character varying(42),
    otp_hash character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamp without time zone NOT NULL,
    used boolean DEFAULT false,
    order_id integer
);


ALTER TABLE public.otp_logs OWNER TO postgres;

--
-- Name: TABLE otp_logs; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.otp_logs IS 'OTP records for order verification';


--
-- Name: COLUMN otp_logs.otp_hash; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.otp_logs.otp_hash IS 'SHA-256 hash of OTP (never store plain text)';


--
-- Name: COLUMN otp_logs.expires_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.otp_logs.expires_at IS 'When this OTP expires';


--
-- Name: COLUMN otp_logs.used; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.otp_logs.used IS 'Whether OTP has been used';


--
-- Name: COLUMN otp_logs.order_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.otp_logs.order_id IS 'Order this OTP is for';


--
-- Name: otp_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.otp_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.otp_logs_id_seq OWNER TO postgres;

--
-- Name: otp_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.otp_logs_id_seq OWNED BY public.otp_logs.id;


--
-- Name: payment_confirmations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payment_confirmations (
    id integer NOT NULL,
    order_id integer NOT NULL,
    buyer_confirmed boolean DEFAULT false,
    seller_confirmed boolean DEFAULT false,
    buyer_confirmed_at timestamp without time zone,
    seller_confirmed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.payment_confirmations OWNER TO postgres;

--
-- Name: TABLE payment_confirmations; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.payment_confirmations IS 'Tracks payment confirmations from both buyer and seller';


--
-- Name: COLUMN payment_confirmations.buyer_confirmed; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.payment_confirmations.buyer_confirmed IS 'Whether buyer confirmed payment was sent';


--
-- Name: COLUMN payment_confirmations.seller_confirmed; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.payment_confirmations.seller_confirmed IS 'Whether seller confirmed payment was received';


--
-- Name: payment_confirmations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.payment_confirmations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payment_confirmations_id_seq OWNER TO postgres;

--
-- Name: payment_confirmations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.payment_confirmations_id_seq OWNED BY public.payment_confirmations.id;


--
-- Name: reviews; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reviews (
    id integer NOT NULL,
    reviewer_address character varying(42) NOT NULL,
    reviewee_address character varying(42) NOT NULL,
    order_id integer,
    rating integer NOT NULL,
    message text,
    is_visible boolean DEFAULT true,
    is_approved boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    approved_by integer,
    approved_at timestamp without time zone,
    CONSTRAINT reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


ALTER TABLE public.reviews OWNER TO postgres;

--
-- Name: TABLE reviews; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.reviews IS 'User reviews and ratings for completed trades';


--
-- Name: COLUMN reviews.reviewer_address; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.reviews.reviewer_address IS 'Address of user who wrote the review';


--
-- Name: COLUMN reviews.reviewee_address; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.reviews.reviewee_address IS 'Address of user being reviewed';


--
-- Name: COLUMN reviews.order_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.reviews.order_id IS 'Order that this review is for';


--
-- Name: COLUMN reviews.rating; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.reviews.rating IS 'Rating from 1-5 stars';


--
-- Name: COLUMN reviews.message; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.reviews.message IS 'Optional review message';


--
-- Name: COLUMN reviews.is_visible; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.reviews.is_visible IS 'Whether review is visible to public';


--
-- Name: COLUMN reviews.is_approved; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.reviews.is_approved IS 'Whether review is approved by admin';


--
-- Name: COLUMN reviews.approved_by; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.reviews.approved_by IS 'Admin who approved the review';


--
-- Name: COLUMN reviews.approved_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.reviews.approved_at IS 'When the review was approved';


--
-- Name: reviews_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.reviews_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.reviews_id_seq OWNER TO postgres;

--
-- Name: reviews_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.reviews_id_seq OWNED BY public.reviews.id;


--
-- Name: support; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.support (
    id integer NOT NULL,
    type character varying(20) NOT NULL,
    value character varying(255) NOT NULL,
    label character varying(100),
    active boolean DEFAULT true,
    priority integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT support_type_check CHECK (((type)::text = ANY ((ARRAY['phone'::character varying, 'email'::character varying])::text[])))
);


ALTER TABLE public.support OWNER TO postgres;

--
-- Name: TABLE support; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.support IS 'Customer support tickets';


--
-- Name: COLUMN support.priority; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.support.priority IS 'LOW, MEDIUM, HIGH, URGENT';


--
-- Name: support_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.support_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.support_id_seq OWNER TO postgres;

--
-- Name: support_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.support_id_seq OWNED BY public.support.id;


--
-- Name: transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.transactions (
    id integer NOT NULL,
    transaction_number character varying(50) NOT NULL,
    order_id integer NOT NULL,
    buyer_address character varying(42) NOT NULL,
    seller_address character varying(42) NOT NULL,
    amount numeric(18,6) NOT NULL,
    token character varying(10) NOT NULL,
    transaction_type character varying(20) NOT NULL,
    status character varying(20) DEFAULT 'PENDING'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamp without time zone,
    CONSTRAINT transactions_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'COMPLETED'::character varying, 'FAILED'::character varying, 'CANCELLED'::character varying])::text[]))),
    CONSTRAINT transactions_transaction_type_check CHECK (((transaction_type)::text = ANY ((ARRAY['BUY'::character varying, 'SELL'::character varying])::text[])))
);


ALTER TABLE public.transactions OWNER TO postgres;

--
-- Name: TABLE transactions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.transactions IS 'Blockchain transaction records';


--
-- Name: COLUMN transactions.status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.transactions.status IS 'PENDING, CONFIRMED, FAILED';


--
-- Name: transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.transactions_id_seq OWNER TO postgres;

--
-- Name: transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.transactions_id_seq OWNED BY public.transactions.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    address character varying(42) NOT NULL,
    name character varying(255),
    phone character varying(20),
    city character varying(100),
    selected_agent_id bigint,
    verified boolean DEFAULT false,
    verified_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    location_id integer,
    selected_agent_ids text[]
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: TABLE users; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.users IS 'User accounts for P2P trading';


--
-- Name: COLUMN users.address; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.address IS 'Ethereum wallet address (unique identifier)';


--
-- Name: COLUMN users.selected_agent_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.selected_agent_id IS 'Single selected agent (legacy, deprecated)';


--
-- Name: COLUMN users.location_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.location_id IS 'User preferred trading location';


--
-- Name: COLUMN users.selected_agent_ids; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.selected_agent_ids IS 'Array of selected agent IDs (TEXT[] - supports multiple agents)';


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: admin_notifications id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_notifications ALTER COLUMN id SET DEFAULT nextval('public.admin_notifications_id_seq'::regclass);


--
-- Name: admin_users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_users ALTER COLUMN id SET DEFAULT nextval('public.admin_users_id_seq'::regclass);


--
-- Name: ads id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ads ALTER COLUMN id SET DEFAULT nextval('public.ads_id_seq'::regclass);


--
-- Name: agents id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agents ALTER COLUMN id SET DEFAULT nextval('public.agents_id_seq'::regclass);


--
-- Name: app_settings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_settings ALTER COLUMN id SET DEFAULT nextval('public.app_settings_id_seq'::regclass);


--
-- Name: appeals id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appeals ALTER COLUMN id SET DEFAULT nextval('public.appeals_id_seq'::regclass);


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: calls id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calls ALTER COLUMN id SET DEFAULT nextval('public.calls_id_seq'::regclass);


--
-- Name: dispute_timeline id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispute_timeline ALTER COLUMN id SET DEFAULT nextval('public.dispute_timeline_id_seq'::regclass);


--
-- Name: disputes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.disputes ALTER COLUMN id SET DEFAULT nextval('public.disputes_id_seq'::regclass);


--
-- Name: locations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.locations ALTER COLUMN id SET DEFAULT nextval('public.locations_id_seq'::regclass);


--
-- Name: orders id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders ALTER COLUMN id SET DEFAULT nextval('public.orders_id_seq'::regclass);


--
-- Name: otp_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.otp_logs ALTER COLUMN id SET DEFAULT nextval('public.otp_logs_id_seq'::regclass);


--
-- Name: payment_confirmations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_confirmations ALTER COLUMN id SET DEFAULT nextval('public.payment_confirmations_id_seq'::regclass);


--
-- Name: reviews id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reviews ALTER COLUMN id SET DEFAULT nextval('public.reviews_id_seq'::regclass);


--
-- Name: support id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support ALTER COLUMN id SET DEFAULT nextval('public.support_id_seq'::regclass);


--
-- Name: transactions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions ALTER COLUMN id SET DEFAULT nextval('public.transactions_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: admin_notifications admin_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_notifications
    ADD CONSTRAINT admin_notifications_pkey PRIMARY KEY (id);


--
-- Name: admin_users admin_users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_pkey PRIMARY KEY (id);


--
-- Name: admin_users admin_users_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_username_key UNIQUE (username);


--
-- Name: ads ads_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ads
    ADD CONSTRAINT ads_pkey PRIMARY KEY (id);


--
-- Name: agents agents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agents
    ADD CONSTRAINT agents_pkey PRIMARY KEY (id);


--
-- Name: app_settings app_settings_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_key_key UNIQUE (key);


--
-- Name: app_settings app_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_pkey PRIMARY KEY (id);


--
-- Name: appeals appeals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appeals
    ADD CONSTRAINT appeals_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: calls calls_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calls
    ADD CONSTRAINT calls_pkey PRIMARY KEY (id);


--
-- Name: dispute_timeline dispute_timeline_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispute_timeline
    ADD CONSTRAINT dispute_timeline_pkey PRIMARY KEY (id);


--
-- Name: disputes disputes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.disputes
    ADD CONSTRAINT disputes_pkey PRIMARY KEY (id);


--
-- Name: locations locations_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_name_key UNIQUE (name);


--
-- Name: locations locations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: otp_logs otp_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.otp_logs
    ADD CONSTRAINT otp_logs_pkey PRIMARY KEY (id);


--
-- Name: payment_confirmations payment_confirmations_order_id_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_confirmations
    ADD CONSTRAINT payment_confirmations_order_id_unique UNIQUE (order_id);


--
-- Name: payment_confirmations payment_confirmations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_confirmations
    ADD CONSTRAINT payment_confirmations_pkey PRIMARY KEY (id);


--
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);


--
-- Name: support support_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.support
    ADD CONSTRAINT support_pkey PRIMARY KEY (id);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: transactions transactions_transaction_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_transaction_number_key UNIQUE (transaction_number);


--
-- Name: users users_address_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_address_key UNIQUE (address);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_admin_notifications_dispute_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_admin_notifications_dispute_id ON public.admin_notifications USING btree (dispute_id);


--
-- Name: idx_admin_notifications_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_admin_notifications_status ON public.admin_notifications USING btree (status);


--
-- Name: idx_ads_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ads_active ON public.ads USING btree (active);


--
-- Name: idx_ads_active_city; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ads_active_city ON public.ads USING btree (active, city);


--
-- Name: idx_ads_city; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ads_city ON public.ads USING btree (city);


--
-- Name: idx_ads_location; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ads_location ON public.ads USING btree (location_id);


--
-- Name: idx_ads_owner; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ads_owner ON public.ads USING btree (owner_address);


--
-- Name: idx_ads_owner_agent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ads_owner_agent ON public.ads USING btree (owner_selected_agent_id);


--
-- Name: idx_ads_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ads_token ON public.ads USING btree (token);


--
-- Name: idx_ads_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ads_type ON public.ads USING btree (type);


--
-- Name: idx_agents_city; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_agents_city ON public.agents USING btree (city);


--
-- Name: idx_agents_location; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_agents_location ON public.agents USING btree (location_id);


--
-- Name: idx_agents_verified; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_agents_verified ON public.agents USING btree (verified);


--
-- Name: idx_appeals_appellant; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_appeals_appellant ON public.appeals USING btree (appellant_address);


--
-- Name: idx_appeals_dispute_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_appeals_dispute_id ON public.appeals USING btree (dispute_id);


--
-- Name: idx_appeals_order_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_appeals_order_id ON public.appeals USING btree (order_id);


--
-- Name: idx_audit_action; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_action ON public.audit_logs USING btree (action);


--
-- Name: idx_audit_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_created ON public.audit_logs USING btree (created_at);


--
-- Name: idx_audit_details; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_details ON public.audit_logs USING gin (details);


--
-- Name: idx_audit_logs_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_user ON public.audit_logs USING btree (user_address);


--
-- Name: idx_audit_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_user ON public.audit_logs USING btree (user_address);


--
-- Name: idx_calls_caller; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_calls_caller ON public.calls USING btree (caller_address);


--
-- Name: idx_calls_participants; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_calls_participants ON public.calls USING btree (caller_address, receiver_address);


--
-- Name: idx_dispute_timeline_dispute_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_dispute_timeline_dispute_id ON public.dispute_timeline USING btree (dispute_id);


--
-- Name: idx_dispute_timeline_order_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_dispute_timeline_order_id ON public.dispute_timeline USING btree (order_id);


--
-- Name: idx_disputes_order_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_disputes_order_id ON public.disputes USING btree (order_id);


--
-- Name: idx_disputes_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_disputes_status ON public.disputes USING btree (status);


--
-- Name: idx_orders_ad; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_ad ON public.orders USING btree (ad_id);


--
-- Name: idx_orders_blockchain_trade_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_blockchain_trade_id ON public.orders USING btree (blockchain_trade_id);


--
-- Name: idx_orders_buyer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_buyer ON public.orders USING btree (buyer_address);


--
-- Name: idx_orders_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_created_at ON public.orders USING btree (created_at);


--
-- Name: idx_orders_seller; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_seller ON public.orders USING btree (seller_address);


--
-- Name: idx_orders_start_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_start_time ON public.orders USING btree (start_time);


--
-- Name: idx_orders_state; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_state ON public.orders USING btree (state);


--
-- Name: idx_otp_expires; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_otp_expires ON public.otp_logs USING btree (expires_at);


--
-- Name: idx_otp_logs_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_otp_logs_order ON public.otp_logs USING btree (order_id);


--
-- Name: idx_otp_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_otp_user ON public.otp_logs USING btree (user_address);


--
-- Name: idx_payment_confirmations_order_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payment_confirmations_order_id ON public.payment_confirmations USING btree (order_id);


--
-- Name: idx_reviews_approved; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reviews_approved ON public.reviews USING btree (is_approved);


--
-- Name: idx_reviews_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reviews_created_at ON public.reviews USING btree (created_at);


--
-- Name: idx_reviews_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reviews_order ON public.reviews USING btree (order_id);


--
-- Name: idx_reviews_order_id_null; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reviews_order_id_null ON public.reviews USING btree (order_id) WHERE (order_id IS NULL);


--
-- Name: idx_reviews_rating; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reviews_rating ON public.reviews USING btree (rating);


--
-- Name: idx_reviews_reviewee; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reviews_reviewee ON public.reviews USING btree (reviewee_address);


--
-- Name: idx_reviews_reviewer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reviews_reviewer ON public.reviews USING btree (reviewer_address);


--
-- Name: idx_reviews_visible; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reviews_visible ON public.reviews USING btree (is_visible);


--
-- Name: idx_support_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_support_active ON public.support USING btree (active, priority);


--
-- Name: idx_transactions_buyer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transactions_buyer ON public.transactions USING btree (buyer_address);


--
-- Name: idx_transactions_number; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transactions_number ON public.transactions USING btree (transaction_number);


--
-- Name: idx_transactions_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transactions_order ON public.transactions USING btree (order_id);


--
-- Name: idx_transactions_seller; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transactions_seller ON public.transactions USING btree (seller_address);


--
-- Name: idx_tx_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tx_order ON public.transactions USING btree (order_id);


--
-- Name: idx_users_address; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_address ON public.users USING btree (address);


--
-- Name: idx_users_location; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_location ON public.users USING btree (location_id);


--
-- Name: idx_users_verified; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_verified ON public.users USING btree (verified);


--
-- Name: app_settings update_app_settings_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_app_settings_updated_at BEFORE UPDATE ON public.app_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: support update_support_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_support_updated_at BEFORE UPDATE ON public.support FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: admin_notifications admin_notifications_dispute_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_notifications
    ADD CONSTRAINT admin_notifications_dispute_id_fkey FOREIGN KEY (dispute_id) REFERENCES public.disputes(id) ON DELETE CASCADE;


--
-- Name: admin_notifications admin_notifications_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admin_notifications
    ADD CONSTRAINT admin_notifications_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: ads ads_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ads
    ADD CONSTRAINT ads_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- Name: ads ads_owner_address_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ads
    ADD CONSTRAINT ads_owner_address_fkey FOREIGN KEY (owner_address) REFERENCES public.users(address);


--
-- Name: ads ads_owner_selected_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ads
    ADD CONSTRAINT ads_owner_selected_agent_id_fkey FOREIGN KEY (owner_selected_agent_id) REFERENCES public.agents(id);


--
-- Name: agents agents_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agents
    ADD CONSTRAINT agents_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- Name: appeals appeals_dispute_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appeals
    ADD CONSTRAINT appeals_dispute_id_fkey FOREIGN KEY (dispute_id) REFERENCES public.disputes(id) ON DELETE CASCADE;


--
-- Name: appeals appeals_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appeals
    ADD CONSTRAINT appeals_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: calls calls_caller_address_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calls
    ADD CONSTRAINT calls_caller_address_fkey FOREIGN KEY (caller_address) REFERENCES public.users(address);


--
-- Name: calls calls_receiver_address_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calls
    ADD CONSTRAINT calls_receiver_address_fkey FOREIGN KEY (receiver_address) REFERENCES public.users(address);


--
-- Name: dispute_timeline dispute_timeline_dispute_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispute_timeline
    ADD CONSTRAINT dispute_timeline_dispute_id_fkey FOREIGN KEY (dispute_id) REFERENCES public.disputes(id) ON DELETE CASCADE;


--
-- Name: dispute_timeline dispute_timeline_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dispute_timeline
    ADD CONSTRAINT dispute_timeline_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: disputes disputes_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.disputes
    ADD CONSTRAINT disputes_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: ads fk_ads_location; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ads
    ADD CONSTRAINT fk_ads_location FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- Name: agents fk_agents_location; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agents
    ADD CONSTRAINT fk_agents_location FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- Name: orders fk_orders_ad; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT fk_orders_ad FOREIGN KEY (ad_id) REFERENCES public.ads(id);


--
-- Name: orders fk_orders_buyer; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT fk_orders_buyer FOREIGN KEY (buyer_address) REFERENCES public.users(address);


--
-- Name: orders fk_orders_seller; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT fk_orders_seller FOREIGN KEY (seller_address) REFERENCES public.users(address);


--
-- Name: otp_logs fk_otp_logs_order; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.otp_logs
    ADD CONSTRAINT fk_otp_logs_order FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: payment_confirmations fk_payment_confirmations_order; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_confirmations
    ADD CONSTRAINT fk_payment_confirmations_order FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: reviews fk_reviews_approved_by; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT fk_reviews_approved_by FOREIGN KEY (approved_by) REFERENCES public.admin_users(id);


--
-- Name: reviews fk_reviews_order; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT fk_reviews_order FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: reviews fk_reviews_reviewee; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT fk_reviews_reviewee FOREIGN KEY (reviewee_address) REFERENCES public.users(address);


--
-- Name: reviews fk_reviews_reviewer; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT fk_reviews_reviewer FOREIGN KEY (reviewer_address) REFERENCES public.users(address);


--
-- Name: transactions fk_transactions_buyer; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT fk_transactions_buyer FOREIGN KEY (buyer_address) REFERENCES public.users(address);


--
-- Name: transactions fk_transactions_order; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT fk_transactions_order FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: transactions fk_transactions_seller; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT fk_transactions_seller FOREIGN KEY (seller_address) REFERENCES public.users(address);


--
-- Name: users fk_users_location; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT fk_users_location FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- Name: orders orders_ad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_ad_id_fkey FOREIGN KEY (ad_id) REFERENCES public.ads(id);


--
-- Name: orders orders_buyer_address_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_buyer_address_fkey FOREIGN KEY (buyer_address) REFERENCES public.users(address);


--
-- Name: orders orders_dispute_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_dispute_id_fkey FOREIGN KEY (dispute_id) REFERENCES public.disputes(id);


--
-- Name: orders orders_payment_confirmation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_payment_confirmation_id_fkey FOREIGN KEY (payment_confirmation_id) REFERENCES public.payment_confirmations(id);


--
-- Name: orders orders_seller_address_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_seller_address_fkey FOREIGN KEY (seller_address) REFERENCES public.users(address);


--
-- Name: otp_logs otp_logs_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.otp_logs
    ADD CONSTRAINT otp_logs_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: payment_confirmations payment_confirmations_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_confirmations
    ADD CONSTRAINT payment_confirmations_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: reviews reviews_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.admin_users(id);


--
-- Name: reviews reviews_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: reviews reviews_reviewee_address_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_reviewee_address_fkey FOREIGN KEY (reviewee_address) REFERENCES public.users(address);


--
-- Name: reviews reviews_reviewer_address_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_reviewer_address_fkey FOREIGN KEY (reviewer_address) REFERENCES public.users(address);


--
-- Name: transactions transactions_buyer_address_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_buyer_address_fkey FOREIGN KEY (buyer_address) REFERENCES public.users(address);


--
-- Name: transactions transactions_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: transactions transactions_seller_address_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_seller_address_fkey FOREIGN KEY (seller_address) REFERENCES public.users(address);


--
-- Name: users users_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id);


--
-- PostgreSQL database dump complete
--

\unrestrict odHGGFmuM8nLQsrAbEGQdbJRONU9HssbIMD9wCB4s8qIyxeZ5AmyJY7I8O4CXHn

