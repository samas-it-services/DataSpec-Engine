# DataSpec Engine

**DataSpec Engine** is a YAML-first, API-first, sensitivity-aware import/export framework for Supabase-backed apps.

It lets you define **entity import/export specs in YAML** (CSV/Excel → Postgres), including:

- Column-level mapping
- Lookups and regex-based extraction
- Validation and defaulting
- Sensitivity classification, masking & unmasking
- JavaScript/TypeScript hooks for custom logic

The engine is designed to run as a **service** with:

- A **containerized API** (Lovable-hosted)
- **Supabase Edge Functions** for lightweight operations
- A reusable **React UI module** that talks to the API only (API-first)

---

## Features

- 🧾 **YAML-only specs** – human-readable, versionable import/export definitions
- 🧩 **API-first** – UI never talks to the DB directly; everything is via HTTP APIs
- 🔒 **Sensitivity & masking** – column-level sensitivity, masking/unmasking, role-based
- 🧪 **Schema validation** – JSON Schema-based validation for YAML specs
- 🧠 **Hooks & extensibility** – JS/TS hooks for custom validation, lookup, transform, masking
- 🧱 **React UI components** – themeable, brandable components for entity/spec selection, preview, etc.
- 💾 **Supabase-native** – metadata + data stored in any Supabase project
- 💸 **Cost-effective hosting** – hybrid model using Supabase Edge Functions + one low-cost container on Lovable

---

## High-Level Architecture

- **React UI** (Lovable)  
  ⮕ talks to **Supabase Edge Functions** (lightweight metadata + small previews)  
  ⮕ talks to **DataSpec API Container** (heavy imports/exports, hooks, masking)  
  ⮕ both talk to **Supabase Postgres** (metadata + entities)

