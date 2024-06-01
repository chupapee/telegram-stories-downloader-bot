import { Userbot } from 'config/userbot';
import { createEffect } from 'effector';
import { bot } from 'index';
import { tempMessageSent, UserInfo } from 'services/stories-service';
import { Markup } from 'telegraf';
import { Api } from 'telegram';
import { FloodWaitError } from 'telegram/errors';

import { notifyAdmin } from './send-message';

export const getAllStoriesFx = createEffect(async (task: UserInfo) => {
  try {
    const client = await Userbot.getInstance();
    const entity = await client.getEntity(task.link);

    notifyAdmin({ task, status: 'start' });

    let activeStories: Api.TypeStoryItem[] = [];
    let pinnedStories: Api.TypeStoryItem[] = [];
    console.log('getting active stories');
    const active = await client.invoke(
      new Api.stories.GetPeerStories({ peer: entity })
    );
    console.log('getting pinned stories');
    const pinned = await client.invoke(
      new Api.stories.GetPinnedStories({ peer: entity })
    );

    if (active.stories.stories.length > 0) {
      activeStories = active.stories.stories;
    }
    if (pinned.stories.length > 0) {
      pinnedStories = pinned.stories.filter(
        (x) => !activeStories.some((y) => y.id === x.id)
      );
    }

    if (activeStories.length > 0 || pinnedStories.length > 0) {
      const text =
        `⚡️ ${activeStories.length} Active stories found and\n` +
        `📌 ${pinnedStories.length} Pinned ones!`;
      bot.telegram
        .sendMessage(
          task.chatId,
          text,
          Markup.keyboard([['Support the bot ❤️']]).resize()
        )
        .then(({ message_id }) => {
          tempMessageSent(message_id);
          notifyAdmin({
            status: 'info',
            baseInfo: text,
          });
        })
        .catch(() => null);
      return { activeStories, pinnedStories };
    }

    return '🚫 Stories not found!';
  } catch (error) {
    if (error instanceof FloodWaitError) {
      return (
        "⚠️ There're too much requests from the users, please wait " +
        (error.seconds / 60).toFixed(0) +
        ' minutes\n\n(You can use [scheduled message](https://telegram.org/blog/scheduled-reminders-themes) feature btw)'
      );
    }

    // TODO: set sleep time after each request to avoid this error
    if (JSON.stringify(error).includes('FloodWaitError')) {
      return '⚠️ Too much requests accepted from users, please try again later';
    }

    if (task.link.startsWith('+')) {
      return '⚠️ if user keeps phone number private, the bot cannot get access to stories';
    }

    return '🚫 Wrong link to user!';
  }
});

export const getParticularStoryFx = createEffect(async (task: UserInfo) => {
  try {
    const client = await Userbot.getInstance();
    const linkPaths = task.link.split('/');
    const storyId = Number(linkPaths.at(-1));
    const username = linkPaths.at(-3);

    const entity = await client.getEntity(username!);

    const storyData = await client.invoke(
      new Api.stories.GetStoriesByID({ id: [storyId], peer: entity })
    );

    if (storyData.stories.length === 0) throw new Error('stories not found!');

    const text = '⚡️ Story founded successfully!';
    bot.telegram
      .sendMessage(
        task.chatId!,
        text,
        Markup.keyboard([['Support the bot ❤️']]).resize()
      )
      .then(({ message_id }) => {
        tempMessageSent(message_id);
        notifyAdmin({ task, status: 'start' });
      })
      .catch(() => null);

    return {
      activeStories: [],
      pinnedStories: [],
      particularStory: storyData.stories[0],
    };
  } catch (error) {
    console.log('ERROR occured:', error);
    return '🚫 Something wrong with the link!';
  }
});
