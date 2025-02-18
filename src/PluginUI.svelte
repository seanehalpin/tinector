<script lang="ts">
  import { onMount } from 'svelte';

  interface Instance {
    id: string;
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }

  interface Connection {
    sourceId: string;
    targetId: string;
    name: string;
  }

  let connections: Connection[] = [];
  let selectedInstances: Instance[] = [];
  let errorMessage: string | null = null;

  // Handle messages from Figma
  onMount(() => {
    window.onmessage = (event) => {
      const msg = event.data.pluginMessage;
      console.log('Received message:', msg.type); // Debug log

      switch (msg.type) {
        case 'CONNECTIONS_UPDATED':
          console.log('Connections updated:', msg.connections); // Debug log
          connections = msg.connections;
          break;

        case 'INSTANCES_SELECTED': // Updated message type
          console.log('Instances selected:', msg.instances); // Debug log
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
    console.log('UI: Creating connection...');
    console.log('UI: Selected instances:', selectedInstances);

    if (selectedInstances.length !== 2) {
      showError('Select exactly two instances to connect');
      return;
    }

    const message = {
      type: 'CREATE_CONNECTION',
      sourceId: selectedInstances[0].id,
      targetId: selectedInstances[1].id
    };

    console.log('UI: Sending message:', message);
    
    parent.postMessage({ 
      pluginMessage: message
    }, '*');
  }

  function deleteConnection(name: string) {
    console.log('Deleting connection:', name); // Debug log
    parent.postMessage({
      pluginMessage: {
        type: 'DELETE_CONNECTION',
        connectionName: name
      }
    }, '*');
  }
</script>

<div class="plugin-container">
  {#if errorMessage}
    <div class="error-message">
      {errorMessage}
    </div>
  {/if}

  <div class="section">
    <div class="section-header">
      <h2>Selected Instances</h2>
    </div>

    <div class="frames-list">
      {#if selectedInstances.length === 0}
        <p class="empty-state">Select two instances to connect</p>
      {:else}
        {#each selectedInstances as instance}
          <div class="frame-item">
            {instance.name || 'Unnamed Instance'}
          </div>
        {/each}
      {/if}
    </div>

    <button 
      class="create-button" 
      class:disabled={selectedInstances.length !== 2}
      on:click={createConnection}
      disabled={selectedInstances.length !== 2}
    >
      Connect Instances
    </button>
  </div>

  <div class="section">
    <div class="section-header">
      <h2>Connections</h2>
    </div>

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
</div>

<style>
  .plugin-container {
    padding: 8px;
    font-family: 'Inter', sans-serif;
    color: var(--figma-color-text);
  }

  .section {
    margin-bottom: 16px;
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

  .create-button {
    width: 100%;
    font-size: 11px;
    padding: 8px;
    margin-top: 8px;
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

  .frames-list, .connections-list {
    border: 1px solid var(--figma-color-border);
    border-radius: 2px;
    padding: 8px;
    min-height: 60px;
    background: var(--figma-color-bg);
  }

  .empty-state {
    color: var(--figma-color-text-tertiary);
    font-size: 11px;
    text-align: center;
    margin: 12px 0;
  }

  .frame-item {
    padding: 6px 8px;
    background: var(--figma-color-bg-secondary);
    border-radius: 4px;
    margin-bottom: 4px;
    font-size: 11px;
  }

  .connection-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 8px;
    background: var(--figma-color-bg-secondary);
    border-radius: 4px;
    margin-bottom: 4px;
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
    padding: 0 4px;
    font-size: 14px;
    line-height: 1;
    border-radius: 4px;
  }

  .delete-button:hover {
    color: var(--figma-color-text-danger);
    background: var(--figma-color-bg-danger);
  }

  .error-message {
    position: fixed;
    top: 8px;
    left: 8px;
    right: 8px;
    background: var(--figma-color-bg-danger);
    color: var(--figma-color-text-ondanger);
    padding: 8px;
    border-radius: 4px;
    font-size: 11px;
    text-align: center;
    animation: fadeIn 0.3s ease-in-out;
    z-index: 100;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-8px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
