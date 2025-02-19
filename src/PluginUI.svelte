<script lang="ts">
  import './style.scss'
  import { fade, fly, scale, blur } from 'svelte/transition'
  import { backOut, quartOut, quintIn } from "svelte/easing"
  import { onMount } from 'svelte';
  import IconSettings from './components/IconSettings.svelte';

  interface Instance {
    id: string;
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rgba?: { r: number; g: number; b: number; a: number };
  }

  interface Connection {
    sourceId: string;
    targetId: string;
    name: string;
  }

  let connections: Connection[] = [];
  let selectedInstances: Instance[] = [];
  let errorMessage: string | null = null;

  // Helper to convert [0,1] rgba to CSS string.
  // If overrideAlpha is provided, that value is used for the alpha.
  function rgbaToCss(rgba: { r: number; g: number; b: number; a: number }, overrideAlpha?: number): string {
    const r = Math.round(rgba.r * 255);
    const g = Math.round(rgba.g * 255);
    const b = Math.round(rgba.b * 255);
    const a = overrideAlpha !== undefined ? overrideAlpha : rgba.a;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  // Handle messages from Figma
  onMount(() => {
    window.onmessage = (event) => {
      const msg = event.data.pluginMessage;
      // console.log('Received message:', msg.type);

      switch (msg.type) {
        case 'CONNECTIONS_UPDATED':
          // console.log('Connections updated:', msg.connections);
          connections = msg.connections;
          break;

        case 'INSTANCES_SELECTED':
          console.log('Instances selected:', msg.instances);
          selectedInstances = msg.instances;
          break;

        case 'ERROR':
          showError(msg.message);
          break;
      }
    };
  });

  function showError(message: string) {
    errorMessage = message;
    setTimeout(() => {
      errorMessage = null;
    }, 3000);
  }

  function createConnection() {
    if (selectedInstances.length !== 2) {
      showError('Select exactly two instances to connect');
      return;
    }

    const message = {
      type: 'CREATE_CONNECTION',
      sourceId: selectedInstances[0].id,
      targetId: selectedInstances[1].id
    };

    parent.postMessage({ pluginMessage: message }, '*');
  }

  function deleteConnection(name: string) {
    parent.postMessage({
      pluginMessage: {
        type: 'DELETE_CONNECTION',
        connectionName: name
      }
    }, '*');
  }

  let showConnections = false;

</script>

<div class="plugin-container">
  {#if errorMessage}
    <div class="error-message">
      {errorMessage}
    </div>
  {/if}

  <div class="section">

    {#if showConnections}
  <div class="connections">
    <div class="connections-list">
      {#if connections.length === 0}
        <p class="empty-state">No connections yet</p>
      {:else}
        {#each connections as connection}
          <div class="connection-item">
            <span class="connection-name">{connection.name}</span>
            <button 
              class="delete-button" 
              on:click={() => deleteConnection(connection.name)}
              title="Delete connection"
            >
              ×
            </button>
          </div>
        {/each}
      {/if}
    </div>
  </div>
  {/if}

    <div class="frames-list">
      {#if selectedInstances.length === 0}
        <p class="empty-state">Select two cards to connect</p>
      {:else}
        {#each selectedInstances as instance}
          <div 
            class="frame-item"
            style="background-color: {instance.rgba ? rgbaToCss(instance.rgba, 0.1) : 'transparent'}; border: 1px solid {instance.rgba ? rgbaToCss(instance.rgba, 0.3) : 'var(--figma-color-border)'};"
            in:fly={{y: 30, duration: 200, easing: backOut, delay: 50 }}
          >
            
          <div 
          class="frame-block"
          style="background-color: {instance.rgba ? rgbaToCss(instance.rgba,1) : 'transparent'};"
          ></div>

          </div>
        {/each}
      {/if}
    </div>

    {#if showConnections}
    <div class="button-holder">
      <button class="create-button" on:click={() => showConnections = false}>Back</button>
    </div>
    {:else}
    <div class="button-holder">
      <button class="settings" on:click={() => showConnections = true}>
        <IconSettings />
      </button>
      {#if selectedInstances.length >= 3}
      <div class="noty">
        Two cards only
      </div>
      {:else}
      <button 
        class="create-button" 
        class:disabled={selectedInstances.length !== 2}
        on:click={createConnection}
        disabled={selectedInstances.length !== 2}
      >
        Connect
      </button>
      {/if}
    </div>
    {/if}
  </div>

  
  
</div>

<style lang="scss">

  .plugin-container {
    padding: 0;
    font-family: 'Inter', sans-serif;
    color: var(--figma-color-text);
    position: relative;
  }

  .section {
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  h2 {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--figma-color-text-secondary);
    margin: 0;
  }

  .button-holder {
    position: fixed;
    bottom: 16px;
    right: 16px;
    z-index: 1000;
    width: calc(100% - 32px);
    display: flex;
    gap: 8px;
  }

  .settings {
    
    padding: 0;
    border: 1px solid var(--figma-color-border);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    height: 30px;
    width: 30px;
    cursor: pointer;
    color: var(--figma-color-text-secondary);
    background: var(--figma-color-bg-secondary);
  }

  .create-button {
    flex: 1;
    width: 100%;
    font-size: 11px;
    display: flex;
    justify-content: center;
    align-items: center;
    height: 30px;
    padding: 0 16px;
    border-radius: 6px;
    border: none;
    background: var(--figma-color-bg-brand);
    color: var(--figma-color-text-onbrand);
    cursor: pointer;
  }

  .create-button:hover:not(.disabled) {
    background: var(--figma-color-bg-brand-hover);
  }

  .create-button.disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  }

  

  .frames-list {
    padding: 16px;
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: center;
    justify-content: center;
    background: var(--figma-color-bg-secondary);
    background-size: 14px 14px;
    background-image: radial-gradient(var(--figma-color-bg-tertiary) 1px, transparent 1px)
  }

  .frame-item {
    padding: 6px 8px;
    border-radius: 14px;
    width: 100%;
    backdrop-filter: blur(10px);
  }

  .frame-block {
    border-radius: 10px;
    width: 30px;
    height: 30px;
    background: var(--figma-color-bg-secondary);
  }

  .empty-state {
    color: var(--figma-color-text-tertiary);
    font-size: 11px;
    text-align: center;
    margin: 0 0 12px 0;
  }

  .noty {
    flex: 1;
    display: flex;
    width: 100%;
    background: var(--figma-color-bg-danger);
    color: var(--figma-color-text-ondanger);
    padding: 8px;
    border-radius: 6px;
    font-size: 11px;
    text-align: center;
    align-items: center;
    justify-content: center;

  }

  .connections-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 16px;
    overflow: scroll;
    margin-bottom: 56px;
  }

  .connection-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 8px;
    background: var(--figma-color-bg-secondary);
    border-radius: 8px;
  }

  .connection-name {
    font-size: 11px;
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-right: 8px;
  }

  .delete-button {
    background: none;
    border: none;
    color: var(--figma-color-text-secondary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 20px;
    width: 20px;
    font-size: 14px;
    line-height: 1;
    border-radius: 6px;
  }

  .delete-button:hover {
    color: var(--figma-color-text-ondanger);
    background: var(--figma-color-bg-danger);
  }

  .connections {
    position: fixed;
    left: 0;
    top: 0;
    z-index: 999;
    background: var(--figma-color-bg);
    height: 100%;
    width: 100%;
    overflow: scroll;
  }

  


</style>
