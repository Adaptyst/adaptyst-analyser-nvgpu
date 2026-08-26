// SPDX-FileCopyrightText: 2026 CERN
// SPDX-License-Identifier: GPL-3.0-or-later

const MODULE_NAME = 'nvgpu';

class TimelineWindow extends Window {
    constructor(deserialized, ...args) {
        super();

        if (!deserialized) {
            this.init(this, ...args);
        }
    }

    getType() {
        return 'nvgpu_timeline';
    }

    getTitle() {
        return 'NVIDIA GPU timeline';
    }

    startResize() {
        return this.inst().getData().timeline != undefined;
    }

    finishResize() {
        this.inst().getData().timeline.resize();
    }

    prepareRefresh() {

    }

    prepareClose() {

    }

    getContentCode() {
        return `
<div class="toolbar">
    <div class="toolbar_texts">
      <div class="glossary">
        The number next to each region name indicates what percentage of the region runtime is CUDA-related.<br />
        <b>Right-click</b> any region to open the details menu (CR = CUDA-related runtime).
      </div>
    </div>
    <div class="toolbar_buttons">
      <div class="toolbar_buttons_right">
        <svg xmlns="http://www.w3.org/2000/svg" class="pointer timeline_font_increase"
             data-icon="font_increase"
             height="24px" width="24px" fill="#000000" onclick="">
          <title>Increase timeline font size</title>
        </svg>
        <svg xmlns="http://www.w3.org/2000/svg" class="pointer timeline_font_decrease"
             data-icon="font_decrease"
             height="24px" width="24px" fill="#000000" onclick="">
          <title>Decrease timeline font size</title>
        </svg>
      </div>
    </div>
</div>
<div class="window_space nvgpu_timeline"></div>
`;
    }

    _setup(data, existing_window) {
        if (!existing_window) {
            this.inst().getData().timeline_font_size =
                Math.max(8, Math.min(24, $('#nvgpu_timeline_font_size').val()));
        }

        let ns_to_ms = (val) => {
            return val / 1000000;
        };

        this.inst().sendRequest({regions: true},
                                result => {
                                    let item_list = [];
                                    let group_list = [];
                                    let max_end = 0;

                                    for (const [key, value] of Object.entries(result)) {
                                        let total_length = 0;
                                        let cuda_runtime_val = 0;

                                        for (const data of Object.values(value.data)) {
                                            cuda_runtime_val += data.length;
                                        }

                                        let index = 0;

                                        for (const [s, l] of value.occurrences) {
                                            let start = ns_to_ms(s);
                                            let end = start + ns_to_ms(l);

                                            max_end = Math.max(max_end, end);

                                            let item = {
                                                id: key + (index++),
                                                group: key,
                                                start: start,
                                                end: end,
                                                color: '#aaaaaa'
                                            };

                                            total_length += l;
                                            item_list.push(item);
                                        }

                                        let group = {
                                            id: key,
                                            label: key + ' (' +
                                                (cuda_runtime_val / total_length * 100).toFixed(2) + '%)',
                                            level: 0
                                        };

                                        value.cuda_runtime = cuda_runtime_val;
                                        value.total_length = total_length;

                                        group_list.push(group);
                                    }

                                    let container = this.inst().getContent().find('.nvgpu_timeline');
                                    container.html('<canvas class="nvgpu_timeline_canvas"></canvas>');

                                    let timeline_context_menu = (props) => {
                                        if (props.group != null) {
                                            let items = [
                                                {
                                                    item: $(`
<div class="header_item">
  Runtime: <span class="runtime"></span><br />
  CUDA-related runtime: <span class="cuda_runtime"></span>
</div>`)
                                                }
                                            ];

                                            let last_item = {
                                                item: $(`
<div class="cuda_summary_item">
  <div class="cuda_summary"></div>
</div>`)
                                            };

                                            let numf = new Intl.NumberFormat('en-US');

                                            let format_val = (val) => {
                                                if (val < 100000) {
                                                    return numf.format(val) + ' ns';
                                                } else if ($('#nvgpu_always_ms').prop('checked') || val < 1000000000) {
                                                    return numf.format(ns_to_ms(val).toFixed(2)) + ' ms';
                                                } else {
                                                    return numf.format((ns_to_ms(val) / 1000).toFixed(2)) + ' s';
                                                }
                                            };

                                            items[0].item.find('.runtime').text(format_val(result[props.group].total_length));
                                            items[0].item.find('.cuda_runtime').text(
                                                format_val(result[props.group].cuda_runtime) + ' (' +
                                                    (result[props.group].cuda_runtime /
                                                     result[props.group].total_length * 100).toFixed(2) + '%)');

                                            let cuda_funcs = Object.entries(result[props.group].data);
                                            cuda_funcs.sort((a, b) => b[1].length - a[1].length);

                                            let spans = [];

                                            let iterate = (name, func, level, spans) => {
                                                let new_span = $('<span><span class="function_name">' +
                                                                 '</span>: <span class="function_runtime"></span> ' +
                                                                 '(<span class="function_percentage"></span>% CR)</span>');
                                                new_span.find('.function_name').text(name);
                                                new_span.css('padding-left', (level * 20) + 'px');
                                                new_span.find('.function_runtime').text(format_val(func.length));
                                                new_span.find('.function_percentage').text(
                                                    (func.length / result[props.group].cuda_runtime * 100).toFixed(2));

                                                last_item.item.find('.cuda_summary').append(new_span);
                                                last_item.item.find('.cuda_summary').append('<br />');

                                                for (const [child_name, child_func] of Object.entries(func.children)) {
                                                    iterate(child_name, child_func, level + 1, spans);
                                                }
                                            };

                                            for (const [name, func] of cuda_funcs) {
                                                iterate(name, func, 0, spans);
                                            }

                                            items.push(last_item);

                                            Menu.createMenuWithCustomBlocks('nvgpu_timeline',
                                                                            props.pageX, props.pageY, items);

                                            props.event.preventDefault();
                                            props.event.stopPropagation();
                                        }
                                    };

                                    this.inst().getData().timeline = new CanvasTimeline(
                                        container.find('.nvgpu_timeline_canvas')[0],
                                        item_list,
                                        group_list,
                                        2 * max_end,
                                        timeline_context_menu,
                                        this.inst().getData().timeline_font_size
                                    );

                                    this.inst().getContent().find('.timeline_font_decrease').on('click', (event) => {
                                        this.inst().onTimelineFontSizeDecreaseClick(event);
                                    });
                                    this.inst().getContent().find('.timeline_font_increase').on('click', (event) => {
                                        this.inst().onTimelineFontSizeIncreaseClick(event);
                                    });

                                    this.inst().hideLoading();
                                }, (xhr, status, error) => {
                                    window.alert('Could not download the module data!');
                                    this.inst().hideLoading();
                                });
    }

    onTimelineFontSizeIncreaseClick(event) {
        this.inst().getData().timeline_font_size = this.inst().getData().timeline.changeFontSize(1);
    }

    onTimelineFontSizeDecreaseClick(event) {
        this.inst().getData().timeline_font_size = this.inst().getData().timeline.changeFontSize(-1);
    }
}

function createRootWindow(entity_id, analysable_id, session) {
    return new TimelineWindow(false, session, entity_id,
                              analysable_id, MODULE_NAME);
}

function getWindowClass(type) {
    if (type === 'nvgpu_timeline') {
        return TimelineWindow;
    } else {
        return undefined;
    }
}

export { createRootWindow, getWindowClass };
