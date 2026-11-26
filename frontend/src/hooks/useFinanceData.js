/**
 * Hook central des données financières : chargement depuis l'API, état local
 * (reducer) et `dispatch` asynchrone qui persiste chaque action côté serveur.
 *
 * Stratégies :
 * - créations / suppressions : appel API puis mise à jour locale (id serveur) ;
 * - éditions inline (enveloppes, capacité, solde) : mise à jour locale immédiate,
 *   puis sauvegarde « debouncée » (une seule requête après la frappe) ;
 * - import CSV : envoi groupé (batch) puis rechargement des transactions.
 */
import { useReducer, useState, useEffect, useCallback, useRef } from "react";
import { transactionsAPI, categoriesAPI, envelopesAPI, settingsAPI, stocksAPI } from "../services/api";
import { reducer, emptyState } from "../lib/state";
import { normalizeTransaction } from "../lib/transactions";

const SAVE_DELAY_MS = 600;   // délai de debounce des éditions inline
const BATCH_SIZE = 1000;     // taille max acceptée par POST /transactions/batch

/** Message d'erreur lisible à partir d'une erreur axios. */
const errorMessage = (error) =>
  error?.response?.data?.error || error?.response?.data?.message || error?.message || "Erreur inconnue";

/**
 * @param {{ success: Function, error: Function } | undefined} toast
 */
export function useFinanceData(toast) {
  const [state, dispatch] = useReducer(reducer, undefined, emptyState);
  const [ready, setReady] = useState(false);
  const [stockPositions, setStockPositions] = useState([]);

  // Toast stable pour les callbacks (évite de recréer dispatch à chaque rendu)
  const toastRef = useRef(toast);
  toastRef.current = toast;

  // Sauvegardes différées en attente, par clé ("env:<id>", "settings")
  const pending = useRef(new Map());
  // Dernières valeurs des réglages à envoyer (fusionnées entre deux frappes)
  const pendingSettings = useRef({});

  /** Planifie (ou replanifie) une sauvegarde différée. */
  const schedule = useCallback((key, save) => {
    clearTimeout(pending.current.get(key)?.timer);
    const timer = setTimeout(async () => {
      pending.current.delete(key);
      try {
        await save();
      } catch (error) {
        toastRef.current?.error(`Sauvegarde impossible : ${errorMessage(error)}`);
      }
    }, SAVE_DELAY_MS);
    pending.current.set(key, { timer, save });
  }, []);

  // Au démontage : exécute immédiatement les sauvegardes en attente (pas de perte de saisie)
  useEffect(() => {
    const map = pending.current;
    return () => {
      for (const { timer, save } of map.values()) {
        clearTimeout(timer);
        save().catch(() => {});
      }
      map.clear();
    };
  }, []);

  // Chargement initial (en parallèle)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [transactions, categories, envelopes, settings] = await Promise.all([
          transactionsAPI.getAll(),
          categoriesAPI.getAll(),
          envelopesAPI.getAll(),
          settingsAPI.get(),
        ]);
        if (!alive) return;
        dispatch({
          type: "LOAD",
          payload: {
            transactions: (transactions || []).map(normalizeTransaction),
            categories: categories || [],
            envelopes: envelopes || [],
            startBalance: settings?.startBalance ?? 0,
            monthlyCapacity: settings?.monthlyCapacity ?? 1000,
          },
        });
        toastRef.current?.success("Données chargées");
      } catch (error) {
        if (alive && error.response?.status !== 429) {
          toastRef.current?.error("Erreur de chargement des données");
        }
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Positions boursières (pour le patrimoine du tableau de bord), après le chargement principal
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    stocksAPI.getAll()
      .then((stocks) => { if (alive) setStockPositions(stocks || []); })
      .catch(() => { if (alive) setStockPositions([]); });
    return () => { alive = false; };
  }, [ready]);

  /** Dispatch asynchrone : persiste l'action via l'API puis met à jour l'état. */
  const apiDispatch = useCallback(async (action) => {
    try {
      switch (action.type) {
        case "ADD_TX": {
          const { date, label, amount, category } = action.tx;
          const created = await transactionsAPI.create({ date, label, amount, category });
          dispatch({ type: "ADD_TX", tx: normalizeTransaction(created) });
          break;
        }
        case "UPDATE_TX": {
          const { id, date, label, amount, category } = action.tx;
          const updated = await transactionsAPI.update(id, { date, label, amount, category });
          dispatch({ type: "UPDATE_TX", tx: normalizeTransaction(updated) });
          break;
        }
        case "DELETE_TX":
          await transactionsAPI.delete(action.id);
          dispatch(action);
          break;

        case "IMPORT_TX": {
          // Envoi par lots de 1000 (limite serveur), sans l'id temporaire client
          const rows = action.txs.map(({ date, label, amount, category }) => ({ date, label, amount, category }));
          let imported = 0;
          for (let i = 0; i < rows.length; i += BATCH_SIZE) {
            const res = await transactionsAPI.batchCreate(rows.slice(i, i + BATCH_SIZE));
            imported += res?.imported ?? 0;
          }
          // Rechargement : récupère les identifiants serveur des transactions importées
          const txs = await transactionsAPI.getAll();
          dispatch({ type: "SET_TXS", txs: txs.map(normalizeTransaction) });
          toastRef.current?.success(`${imported} transaction(s) importée(s)`);
          break;
        }

        case "ADD_CAT": {
          const created = await categoriesAPI.create(action.cat);
          dispatch({ type: "ADD_CAT", cat: created });
          break;
        }
        case "UPDATE_CAT": {
          const updated = await categoriesAPI.update(action.cat.id, action.cat);
          dispatch({ type: "UPDATE_CAT", cat: updated });
          break;
        }
        case "DELETE_CAT":
          await categoriesAPI.delete(action.id);
          dispatch(action);
          break;

        case "ADD_ENV": {
          const created = await envelopesAPI.create(action.env);
          dispatch({ type: "ADD_ENV", env: created });
          break;
        }
        case "UPDATE_ENV": {
          // Affichage immédiat, sauvegarde différée (édition inline frappe par frappe)
          dispatch(action);
          const env = action.env;
          // Un nom vide est un état transitoire de saisie : on ne l'envoie pas (refusé par l'API)
          if (!String(env.name || "").trim()) break;
          const { name, type, balance, expectedReturn, monthly, color } = env;
          schedule(`env:${env.id}`, () => envelopesAPI.update(env.id, { name, type, balance, expectedReturn, monthly, color }));
          break;
        }
        case "DELETE_ENV": {
          // Annule une éventuelle sauvegarde en attente de l'enveloppe supprimée
          clearTimeout(pending.current.get(`env:${action.id}`)?.timer);
          pending.current.delete(`env:${action.id}`);
          await envelopesAPI.delete(action.id);
          dispatch(action);
          break;
        }

        case "SET_CAPACITY":
        case "SET_START": {
          dispatch(action);
          const field = action.type === "SET_START" ? "startBalance" : "monthlyCapacity";
          pendingSettings.current = { ...pendingSettings.current, [field]: action.value };
          schedule("settings", () => {
            const payload = pendingSettings.current;
            pendingSettings.current = {};
            return settingsAPI.update(payload);
          });
          break;
        }

        default:
          dispatch(action);
      }
    } catch (error) {
      toastRef.current?.error(`Erreur : ${errorMessage(error)}`);
      throw error;
    }
  }, [schedule]);

  return { state, dispatch: apiDispatch, ready, stockPositions };
}
