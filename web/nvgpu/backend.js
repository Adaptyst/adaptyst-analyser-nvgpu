// SPDX-FileCopyrightText: 2025 CERN
// SPDX-License-Identifier: GPL-3.0-or-later

const MODULE_NAME = 'nvgpu';

class TimelineWindow extends Window {
    getType() {
        return 'nvgpu_timeline';
    }

    getTitle() {
        return 'NVIDIA GPU timeline';
    }

    startResize() {

    }

    finishResize() {

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
        The number inside blocks indicates what percentage of the region runtime is CUDA-related.<br />
        <b>Right-click</b> any region to open the details menu (CR = CUDA-related runtime).
      </div>
    </div>
</div>
<div class="window_space nvgpu_timeline"></div>
`;
    }

    _setup(data, existing_window) {
        let ns_to_ms = (val) => {
            return val / 1000000;
        };

        this.sendRequest({regions: true},
                         result => {
                             let item_list = [];
                             let group_list = [];
                             let max_end = 0;

                             for (const [key, value] of Object.entries(result)) {
                                 let group = {
                                     id: key,
                                     content: key,
                                     showNested: false
                                 }

                                 let start = ns_to_ms(value.start);
                                 let end = start + ns_to_ms(value.length);

                                 max_end = Math.max(max_end, end);

                                 let cuda_runtime_val = 0;

                                 for (const data of Object.values(value.data)) {
                                     cuda_runtime_val += data.length;
                                 }

                                 value.cuda_runtime = cuda_runtime_val;

                                 let item = {
                                     id: key,
                                     group: key,
                                     type: 'background',
                                     content: (cuda_runtime_val / value.length * 100).toFixed(2) + '%',
                                     start: start,
                                     end: end,
                                     style: 'color:#ffffff; background-color:#009933; z-index:-1'
                                 };

                                 item_list.push(item);
                                 group_list.push(group);
                             }

                             let container = this.getContent().find('.nvgpu_timeline');
                             container.html('');

                             let timeline = new vis.Timeline(
                                 container[0],
                                 item_list,
                                 group_list,
                                 {
                                     format: {
                                         minorLabels: {
                                             millisecond:'x [ms]',
                                             second:     'X [s]',
                                             minute:     'X [s]',
                                             hour:       'X [s]',
                                             weekday:    'X [s]',
                                             day:        'X [s]',
                                             week:       'X [s]',
                                             month:      'X [s]',
                                             year:       'X [s]'
                                         }
                                     },
                                     showMajorLabels: false,
                                     min: 0,
                                     max: 2 * max_end
                                 }
                             );

                             timeline.on('contextmenu', (props) => {
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

                                     items[0].item.find('.runtime').text(format_val(result[props.group].length));
                                     items[0].item.find('.cuda_runtime').text(format_val(result[props.group].cuda_runtime));

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
                             });

                             this.hideLoading();
                         }, (xhr, status, error) => {
                             window.alert('Could not download the module data!');
                             this.hideLoading();
                         });
    }
}

function createRootWindow(entity_id, node_id, session) {
    return new TimelineWindow(session, entity_id, node_id, MODULE_NAME, {});
}

export { createRootWindow };
