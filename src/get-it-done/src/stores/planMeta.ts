import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { PlanMeta } from '../types'

const PLAN_META_KEY = 'get-it-done-plan-meta-v1'

function loadPlanMeta(): PlanMeta {
  try {
    const raw = localStorage.getItem(PLAN_META_KEY)
    if (!raw) return { lastReviewedAt: null, dayPlanDate: null }
    return JSON.parse(raw) as PlanMeta
  } catch {
    return { lastReviewedAt: null, dayPlanDate: null }
  }
}

export const usePlanMetaStore = defineStore('planMeta', () => {
  const planMeta = ref<PlanMeta>(loadPlanMeta())

  function persistPlanMeta(): void {
    localStorage.setItem(PLAN_META_KEY, JSON.stringify(planMeta.value))
  }

  return { planMeta, persistPlanMeta }
})
