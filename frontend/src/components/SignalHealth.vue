<script setup lang="ts">
import { ref, computed } from 'vue';
import { useCanBusStore } from '../store/canbus';
import type { CollectionStage, SignalHealthScore } from '../types';

const store = useCanBusStore();
const selectedStage = ref<CollectionStage>('longterm');
const selectedSignal = ref<string | null>(null);

const stageLabels: Record<CollectionStage, string> = {
  recent: '近期 (10s)',
  midterm: '中期 (30s)',
  longterm: '长期 (60s)'
};

function getRiskColor(level: string): string {
  switch (level) {
    case 'healthy': return 'text-green-400';
    case 'warning': return 'text-yellow-400';
    case 'critical': return 'text-red-400';
    default: return 'text-gray-400';
  }
}

function getRiskBg(level: string): string {
  switch (level) {
    case 'healthy': return 'bg-green-500';
    case 'warning': return 'bg-yellow-500';
    case 'critical': return 'bg-red-500';
    default: return 'bg-gray-500';
  }
}

function getRiskLabel(level: string): string {
  switch (level) {
    case 'healthy': return '健康';
    case 'warning': return '警告';
    case 'critical': return '危险';
    default: return '未知';
  }
}

function getScoreColor(score: number): string {
  if (score >= 70) return 'text-green-400';
  if (score >= 40) return 'text-yellow-400';
  return 'text-red-400';
}

function getScoreBarColor(score: number): string {
  if (score >= 70) return 'bg-green-500';
  if (score >= 40) return 'bg-yellow-500';
  return 'bg-red-500';
}

function selectSignal(name: string) {
  selectedSignal.value = selectedSignal.value === name ? null : name;
}

const selectedSignalData = computed<SignalHealthScore | null>(() => {
  if (!selectedSignal.value) return null;
  return store.healthScores.find(s => s.signalName === selectedSignal.value) || null;
});
</script>

<template>
  <div class="flex flex-col h-full bg-gray-900 overflow-hidden">
    <!-- Header -->
    <div class="px-4 py-2 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
      <h3 class="text-sm font-semibold text-gray-300">信号健康评分</h3>
      <div class="flex items-center gap-1">
        <button
          v-for="(label, key) in stageLabels"
          :key="key"
          @click="selectedStage = key as CollectionStage"
          class="px-2 py-1 text-xs rounded transition-colors"
          :class="selectedStage === key
            ? 'bg-cyan-600 text-white'
            : 'bg-gray-700 text-gray-400 hover:bg-gray-600'"
        >
          {{ label }}
        </button>
      </div>
    </div>

    <!-- Summary Cards -->
    <div class="grid grid-cols-4 gap-2 p-3 border-b border-gray-700">
      <div class="bg-gray-800 rounded-lg p-3">
        <div class="text-xs text-gray-500 mb-1">信号总数</div>
        <div class="text-xl font-bold text-gray-100">{{ store.healthSummary.totalSignals }}</div>
      </div>
      <div class="bg-gray-800 rounded-lg p-3">
        <div class="text-xs text-gray-500 mb-1">平均分</div>
        <div class="text-xl font-bold" :class="getScoreColor(store.healthSummary.averageScore)">
          {{ store.healthSummary.averageScore }}
        </div>
      </div>
      <div class="bg-gray-800 rounded-lg p-3">
        <div class="text-xs text-gray-500 mb-1">健康</div>
        <div class="text-xl font-bold text-green-400">{{ store.healthSummary.healthyCount }}</div>
      </div>
      <div class="bg-gray-800 rounded-lg p-3">
        <div class="text-xs text-gray-500 mb-1">警告/危险</div>
        <div class="text-xl font-bold">
          <span class="text-yellow-400">{{ store.healthSummary.warningCount }}</span>
          <span class="text-gray-600">/</span>
          <span class="text-red-400">{{ store.healthSummary.criticalCount }}</span>
        </div>
      </div>
    </div>

    <!-- Signal List -->
    <div class="flex-1 overflow-auto">
      <div v-if="store.healthScores.length === 0" class="flex items-center justify-center h-full">
        <p class="text-gray-600 text-sm">暂无信号数据 — 点击"开始捕获"以生成健康评分</p>
      </div>

      <div v-else class="p-3 space-y-2">
        <div
          v-for="score in store.healthScores"
          :key="score.signalName"
          @click="selectSignal(score.signalName)"
          class="bg-gray-800 rounded-lg p-3 cursor-pointer transition-colors hover:bg-gray-750"
          :class="{ 'ring-2 ring-cyan-500': selectedSignal === score.signalName }"
        >
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2">
              <span
                class="w-2 h-2 rounded-full"
                :class="getRiskBg(score.riskLevel)"
              ></span>
              <span class="text-sm font-medium text-gray-200">{{ score.signalName }}</span>
              <span class="text-xs text-gray-500">{{ score.unit }}</span>
            </div>
            <div class="text-right">
              <span class="text-lg font-bold" :class="getScoreColor(score.overallScore)">
                {{ score.overallScore }}
              </span>
              <span class="text-xs text-gray-500 ml-1">分</span>
            </div>
          </div>

          <div class="w-full bg-gray-700 rounded-full h-1.5 mb-2">
            <div
              class="h-1.5 rounded-full transition-all duration-300"
              :class="getScoreBarColor(score.overallScore)"
              :style="{ width: score.overallScore + '%' }"
            ></div>
          </div>

          <div class="grid grid-cols-3 gap-2 text-xs">
            <div class="bg-gray-900/50 rounded px-2 py-1">
              <div class="text-gray-500">波动幅度</div>
              <div class="text-cyan-400 font-mono">{{ score.stages[selectedStage].fluctuation }}%</div>
            </div>
            <div class="bg-gray-900/50 rounded px-2 py-1">
              <div class="text-gray-500">超限次数</div>
              <div class="text-orange-400 font-mono">{{ score.stages[selectedStage].overLimitCount }}</div>
            </div>
            <div class="bg-gray-900/50 rounded px-2 py-1">
              <div class="text-gray-500">异常时长</div>
              <div class="text-red-400 font-mono">{{ score.stages[selectedStage].abnormalDuration }}s</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Detail Panel -->
    <div
      v-if="selectedSignalData"
      class="border-t border-gray-700 bg-gray-850 p-4"
      style="background-color: #1a2234;"
    >
      <h3 class="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
        <span
          class="w-2 h-2 rounded-full"
          :class="getRiskBg(selectedSignalData.riskLevel)"
        ></span>
        {{ selectedSignalData.signalName }} 详细分析
        <span class="text-gray-500 font-normal text-xs">
          {{ getRiskLabel(selectedSignalData.riskLevel) }}
        </span>
      </h3>

      <div class="grid grid-cols-3 gap-3">
        <div
          v-for="(label, key) in stageLabels"
          :key="key"
          class="bg-gray-800 rounded-lg p-3"
        >
          <div class="text-xs text-gray-500 mb-2">{{ label }}</div>

          <div class="space-y-2 text-xs">
            <div class="flex justify-between">
              <span class="text-gray-500">采样数</span>
              <span class="text-gray-300 font-mono">{{ selectedSignalData.stages[key as CollectionStage].sampleCount }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500">平均值</span>
              <span class="text-gray-300 font-mono">{{ selectedSignalData.stages[key as CollectionStage].averageValue }} {{ selectedSignalData.unit }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500">最大值</span>
              <span class="text-gray-300 font-mono">{{ selectedSignalData.stages[key as CollectionStage].maxValue }} {{ selectedSignalData.unit }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500">最小值</span>
              <span class="text-gray-300 font-mono">{{ selectedSignalData.stages[key as CollectionStage].minValue }} {{ selectedSignalData.unit }}</span>
            </div>
            <div class="border-t border-gray-700 pt-2 flex justify-between">
              <span class="text-gray-500">波动幅度</span>
              <span class="text-cyan-400 font-mono font-medium">{{ selectedSignalData.stages[key as CollectionStage].fluctuation }}%</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500">超限次数</span>
              <span class="text-orange-400 font-mono font-medium">{{ selectedSignalData.stages[key as CollectionStage].overLimitCount }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500">异常时长</span>
              <span class="text-red-400 font-mono font-medium">{{ selectedSignalData.stages[key as CollectionStage].abnormalDuration }}s</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
