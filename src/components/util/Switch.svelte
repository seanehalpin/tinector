<script lang="ts">

  export let checked = false;

</script>

<label class="switch">
  <input type="checkbox" bind:checked={checked}>
  <span class="slider round"></span>
</label>

<style lang="scss">
  .switch {
    position: relative;
    display: inline-block;
    width: 28px;
    height: 14px;
  }
  .switch input { 
    opacity: 0;
    width: 0;
    height: 0;
  }
  .slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: var(--figma-color-bg-disabled);
    transition: transform 0.15s ease-in-out, background-color 0.15s ease-in-out;

    &:hover {
      &:before {
        background-color: var(--figma-color-bg-hover);
      }
    }
  }

  .slider:before {
    position: absolute;
    content: "";
    height: 12px;
    width: 12px;
    left: 1px;
    bottom: 1px;
    background-color: var(--figma-color-bg);
    transition: transform 0.15s ease-in-out, background-color 0.15s ease-in-out;
  }
  input:checked + .slider {
    background-color: var(--figma-color-bg-inverse);
  }

  input:focus-visible + .slider {
    outline: 2px solid var(--figma-color-border-selected);
    outline-offset: 1px;
    border-radius: 1px;
    opacity: 1;
  }

  input:checked + .slider:before {
    transform: translate3d(14px,0,0);
  }

  /* Rounded sliders */
  .slider.round {
    border-radius: 28px;
  }

  .slider.round:before {
    border-radius: 50%;
  }
</style>